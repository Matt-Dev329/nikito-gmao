import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export interface TacheAValider {
  id: string;
  libelle: string;
  echeance: string;
}

/** Tâches récurrentes à valider (ex. « Envoi de pièce du laser game » le vendredi) : restent affichées jusqu'à validation */
export function useTachesAValider() {
  const { utilisateur } = useAuth();
  return useQuery({
    queryKey: ['taches-a-valider', utilisateur?.id],
    enabled: !!utilisateur?.id,
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('taches_a_valider')
        .select('id, libelle, echeance')
        .is('valide_le', null)
        .order('echeance', { ascending: true });
      if (error) throw error;
      return (data ?? []) as TacheAValider[];
    },
  });
}

export function useValiderTache() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('valider_tache', { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['taches-a-valider'] }),
  });
}
