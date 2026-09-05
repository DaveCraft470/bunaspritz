// Must be imported before @supabase/supabase-js touches URL/fetch on native.
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import { SUPABASE_ANON_KEY, SUPABASE_URL } from '@/constants/supabase';

// .env is gitignored, so EAS Build (which clones from git, never sees .env)
// and a fresh clone both fall through to the committed constants below.
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || SUPABASE_ANON_KEY;

// The anon/publishable key is safe to embed client-side (same as the Mapbox
// token in constants/mapbox.ts) — access is enforced by RLS, not by keeping
// this secret.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
