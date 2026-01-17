let client: any | null = null;
let clientPromise: Promise<any | null> | null = null;

export const getSupabase = async () => {
  if (client) return client;
  if (clientPromise) return clientPromise;

  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (!url || !anonKey) {
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
