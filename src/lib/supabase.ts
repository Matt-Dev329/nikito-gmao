import { createClient } from '@supabase/supabase-js';

const url = (import.meta as unknown as { env: Record<string, string> }).env.VITE_SUPABASE_URL;
const key = (import.meta as unknown as { env: Record<string, string> }).env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  throw new Error(
    'Variables Supabase manquantes. Copier .env.example vers .env.local et remplir VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY'
  );
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: { 'x-client-info': 'nikito-gmao-web' },
  },
});
