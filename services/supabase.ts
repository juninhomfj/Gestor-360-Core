let client: any | null = null;
let clientPromise: Promise<any | null> | null = null;
let envWarned = false;

const readSupabaseEnv = () => {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  return { url, anonKey };
};

export const validateSupabaseEnv = () => {
  const { url, anonKey } = readSupabaseEnv();
  const ok = Boolean(url && anonKey);
  if (!ok && !envWarned) {
    envWarned = true;
    console.warn('[Supabase] Variáveis ausentes no ambiente.', {
      hasUrl: Boolean(url),
      hasAnonKey: Boolean(anonKey),
      mode: import.meta.env.MODE
    });
  }
  return { ok, url, anonKey };
};

export const getSupabase = async () => {
  if (client) return client;
  if (clientPromise) return clientPromise;

  const { url, anonKey, ok } = validateSupabaseEnv();

  if (!ok) {
    return null;
  }

  clientPromise = import(
    /* @vite-ignore */ '@supabase/supabase-js'
  )
    .then(({ createClient }) => {
      client = createClient(url, anonKey, {
        realtime: { params: { eventsPerSecond: 10 } },
      });
      return client;
    })
    .catch((error) => {
      console.warn('[Supabase] Dependência indisponível:', error);
      clientPromise = null;
      return null;
    });

  return clientPromise;
};
