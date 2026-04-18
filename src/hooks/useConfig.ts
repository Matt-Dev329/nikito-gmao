import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

interface ConfigGlobale {
  config: Record<string, string>;
  dateLancement: Date | null;
  enProduction: boolean;
  avantLancement: boolean;
}

async function fetchConfig(): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('config_globale')
    .select('cle, valeur');
  if (error) throw error;
  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    map[row.cle] = row.valeur;
  }
  return map;
}

export function useConfig(): ConfigGlobale & { isLoading: boolean } {
  const { data: config, isLoading } = useQuery({
    queryKey: ['config_globale'],
    queryFn: fetchConfig,
    staleTime: 5 * 60_000,
    refetchInterval: 10 * 60_000,
  });

  const map = config ?? {};
  const dateLancement = map.date_lancement ? new Date(map.date_lancement + 'T00:00:00') : null;
  const enProduction = map.app_en_production === 'true';
  const avantLancement = dateLancement ? new Date() < dateLancement : true;

  return { config: map, dateLancement, enProduction, avantLancement, isLoading };
}

export async function updateConfig(cle: string, valeur: string) {
  const { error } = await supabase
    .from('config_globale')
    .update({ valeur, modifie_le: new Date().toISOString() })
    .eq('cle', cle);
  if (error) throw error;
}

export function useInvalidateConfig() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['config_globale'] });
}
