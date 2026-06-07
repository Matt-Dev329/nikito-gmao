import { createClient } from '@supabase/supabase-js';
// Types générés disponibles dans '@/types/database.generated' (Database).
// Adoption incrémentale (cf. axe « types ») : brancher createClient<Database>
// déclenche ~37 corrections sur 14 fichiers (nullable/enum, null vs undefined
// dans les RPC, payloads insert/update) à traiter par lots testés.

export const supabaseUrl = (import.meta as unknown as { env: Record<string, string> }).env.VITE_SUPABASE_URL;
export const supabaseAnonKey = (import.meta as unknown as { env: Record<string, string> }).env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Variables Supabase manquantes. Copier .env.example vers .env.local et remplir VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: { 'x-client-info': 'nikito-gmao-web' },
  },
});
