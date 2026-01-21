export type NetworkRetryOptions = {
  retries?: number;
  backoffBaseMs?: number;
  backoffMaxMs?: number;
  retryStatuses?: number[];
};

export type NetworkFetchOptions = NetworkRetryOptions & {
  lockKey?: string;
  pauseInBackground?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
};

const DEFAULT_RETRY_STATUSES = [408, 429, 500, 502, 503, 504];
const DEFAULT_RETRIES = 2;
const DEFAULT_BACKOFF_BASE_MS = 500;
const DEFAULT_BACKOFF_MAX_MS = 8000;
const MAX_CONCURRENT_REQUESTS = 6;

let activeCount = 0;
const queue: Array<{ start: () => void; pauseInBackground: boolean }> = [];
const lockMap = new Map<string, Promise<Response>>();
let isPaused = typeof document !== 'undefined' && document.visibilityState === 'hidden';

const waitForResume = () => {
  if (!isPaused) return Promise.resolve();
  return new Promise<void>((resolve) => {
    const handle = () => {
      if (!isPaused) {
        document.removeEventListener('visibilitychange', handle);
        resolve();
      }
    };
    document.addEventListener('visibilitychange', handle);
  });
};

const scheduleNext = () => {
  while (activeCount < MAX_CONCURRENT_REQUESTS && queue.length > 0) {
    let index = 0;
    while (index < queue.length && isPaused && queue[index].pauseInBackground) {
      index += 1;
    }
    if (index >= queue.length) return;
    const next = queue.splice(index, 1)[0];
    if (next) next.start();
  }
};

const acquireSlot = async (pauseInBackground: boolean) => {
  if (pauseInBackground && isPaused) {
    await waitForResume();
  }

  return new Promise<() => void>((resolve) => {
    const start = () => {
      activeCount += 1;
      resolve(() => {
        activeCount = Math.max(0, activeCount - 1);
        scheduleNext();
      });
    };

    if (activeCount < MAX_CONCURRENT_REQUESTS && (!isPaused || !pauseInBackground)) {
      start();
    } else {
      queue.push({ start, pauseInBackground });
    }
  });
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const computeBackoff = (attempt: number, baseMs: number, maxMs: number) => {
  const raw = Math.min(maxMs, baseMs * Math.pow(2, attempt));
  const jitter = raw * (0.8 + Math.random() * 0.4);
  return Math.round(jitter);
};

const attachAbortSignal = (controller: AbortController, signal?: AbortSignal) => {
  if (!signal) return () => {};
  if (signal.aborted) {
    controller.abort();
    return () => {};
  }
  const handler = () => controller.abort();
  signal.addEventListener('abort', handler, { once: true });
  return () => signal.removeEventListener('abort', handler);
};

const shouldRetryResponse = (response: Response, retryStatuses: number[]) =>
  retryStatuses.includes(response.status);

const shouldRetryError = (error: unknown) => {
  if (!error) return true;
  if ((error as Error).name === 'AbortError') return false;
  return true;
};

export const networkFetch = async (
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: NetworkFetchOptions = {}
): Promise<Response> => {
  const {
    lockKey,
    pauseInBackground = true,
    retries = DEFAULT_RETRIES,
    backoffBaseMs = DEFAULT_BACKOFF_BASE_MS,
    backoffMaxMs = DEFAULT_BACKOFF_MAX_MS,
    retryStatuses = DEFAULT_RETRY_STATUSES,
    timeoutMs,
    signal
  } = options;

  if (lockKey) {
    const existing = lockMap.get(lockKey);
    if (existing) return existing;
  }

  const requestPromise = (async () => {
    const release = await acquireSlot(pauseInBackground);
    const controller = new AbortController();
    const detachAbort = attachAbortSignal(controller, signal);
    const timeoutId = timeoutMs
      ? setTimeout(() => controller.abort(), timeoutMs)
      : undefined;

    try {
      let attempt = 0;
      while (true) {
        try {
          const response = await fetch(input, {
            ...init,
            signal: controller.signal
          });
          if (response.ok) return response;
          if (attempt < retries && shouldRetryResponse(response, retryStatuses)) {
            const delay = computeBackoff(attempt, backoffBaseMs, backoffMaxMs);
            attempt += 1;
            await sleep(delay);
            continue;
          }
          return response;
        } catch (error) {
          if (attempt < retries && shouldRetryError(error)) {
            const delay = computeBackoff(attempt, backoffBaseMs, backoffMaxMs);
            attempt += 1;
            await sleep(delay);
            continue;
          }
          throw error;
        }
      }
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      detachAbort();
      release();
    }
  })();

  if (lockKey) {
    lockMap.set(lockKey, requestPromise);
    requestPromise.finally(() => lockMap.delete(lockKey));
  }

  return requestPromise;
};

export const setNetworkPaused = (paused: boolean) => {
  isPaused = paused;
  if (!isPaused) scheduleNext();
};

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    setNetworkPaused(document.visibilityState === 'hidden');
  });
}
