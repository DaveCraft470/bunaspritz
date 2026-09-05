// Public, RLS-protected values — safe to commit, same as the Mapbox token in
// constants/mapbox.ts. .env's EXPO_PUBLIC_* vars (if present) still take
// priority, but a committed default means a fresh clone or an EAS build
// (which never sees .env — it's gitignored) doesn't crash on missing config.
export const SUPABASE_URL = 'https://bumhqcujuahkbxtxphvr.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_Y1xj_4lLeqONVj2vIWWn_g_XHvOaLfT';
