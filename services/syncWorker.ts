import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { getPendingSyncs, dbPut } from '../storage/db';
import { SyncEntry } from '../types';
import { sanitizeForFirestore } from '../utils/firestoreUtils';

const SYNC_INTERVAL_MS = 5000;
const SYNC_TIMEOUT_MS = 15000;
const MAX_SYNC_RETRIES = 5;
const BASE_BACKOFF_MS = 1500;
const MAX_BACKOFF_MS = 60000;
let syncInterval: number | null = null;
let syncInFlight = false;

const isOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine !== false);

const isTransientError = (e: any): boolean => {
  const code = String(e?.code || '');
  const msg = String(e?.message || '');
  return (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    code === 'resource-exhausted' ||
    code === 'internal' ||
    code === 'cancelled' ||
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('timeout')
  );
};

const computeBackoff = (retryCount: number) => {
  const exp = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * Math.pow(2, Math.max(0, retryCount)));
  const jitter = Math.floor(Math.random() * 500);
  return exp + jitter;
};

const updateSyncEntry = async (entry: SyncEntry, patch: Partial<SyncEntry>) => {
  const updatedEntry: SyncEntry = {
    ...entry,
    ...patch
  };
  await dbPut('sync_queue', updatedEntry);
};

const publishEntry = async (entry: SyncEntry) => {
    const ref = doc(db, entry.table, entry.rowId);
    if (entry.type === 'DELETE') {
        await deleteDoc(ref);
        return;
    }
    if (!entry.data || Object.keys(entry.data).length === 0) {
        throw new Error('Payload ausente para sincronização.');
    }
    await setDoc(ref, sanitizeForFirestore(entry.data), { merge: true });
};

const publishEntryWithTimeout = async (entry: SyncEntry) => {
    await Promise.race([
        publishEntry(entry),
        new Promise((_, reject) => {
            window.setTimeout(() => reject(new Error('Timeout ao sincronizar payload.')), SYNC_TIMEOUT_MS);
        })
    ]);
};

const processPendingSyncs = async () => {
  if (syncInFlight) return;
  if (!isOnline()) return;
  syncInFlight = true;
  try {
    const pending = await getPendingSyncs();

    // Ordena por timestamp para preservar ordem aproximada.
    const ordered = [...pending].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    const now = Date.now();

    for (const entry of ordered) {
      // respeita agendamento (timestamp futuro usado como nextAttemptAt)
      if ((entry.timestamp || 0) > now) continue;

      if (entry.retryCount >= MAX_SYNC_RETRIES) {
        await updateSyncEntry(entry, { status: 'FAILED', retryCount: entry.retryCount + 1 });
        continue;
      }

      try {
        await updateSyncEntry(entry, { status: 'SYNCING' });
        await publishEntryWithTimeout(entry);
        await updateSyncEntry(entry, { status: 'COMPLETED' });
      } catch (error: any) {
        if (isTransientError(error)) {
          const backoff = computeBackoff(entry.retryCount);
          await updateSyncEntry(entry, {
            status: 'PENDING',
            retryCount: entry.retryCount + 1,
            timestamp: Date.now() + backoff
          });
          continue;
        }

        await updateSyncEntry(entry, { status: 'FAILED', retryCount: entry.retryCount + 1 });
      }
    }
  } finally {
    syncInFlight = false;
  }
};

export const startSyncWorker = () => {
    if (syncInterval !== null) return () => {};
    processPendingSyncs();
    syncInterval = window.setInterval(processPendingSyncs, SYNC_INTERVAL_MS);
    const onOnline = () => processPendingSyncs();
    window.addEventListener('online', onOnline);
    return () => {
        if (syncInterval !== null) {
            window.clearInterval(syncInterval);
            syncInterval = null;
        }
        window.removeEventListener('online', onOnline);
    };
};
