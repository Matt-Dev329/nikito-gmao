import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export function useAttractionsParc(parcId: string | undefined) {
  return useQuery({
    queryKey: ['attractions-parc', parcId],
    enabled: !!parcId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parc_attractions')
        .select(`
          id,
          quantite,
          categorie_id,
          categorie:categories_equipement!parc_attractions_categorie_id_fkey(id, nom)
        `)
        .eq('parc_id', parcId!)
        .order('categorie_id');

      if (error) {
        console.error('useAttractionsParc error:', error);
        throw error;
      }
      return data ?? [];
    },
  });
}

export function useAjouterAttraction(parcId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { categorieId: string; quantite: number }) => {
      const { data, error } = await supabase
        .from('parc_attractions')
        .insert({
          parc_id: parcId,
          categorie_id: params.categorieId,
          quantite: params.quantite,
        })
        .select('*, categories_equipement(id, code, nom, criticite_defaut)')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attractions-parc', parcId] });
      qc.invalidateQueries({ queryKey: ['points_parc', parcId] });
    },
  });
}

export function useSupprimerAttraction(parcId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (attractionId: string) => {
      const { error } = await supabase
        .from('parc_attractions')
        .delete()
        .eq('id', attractionId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attractions-parc', parcId] });
      qc.invalidateQueries({ queryKey: ['points_parc', parcId] });
    },
  });
}

export function useModifierQuantiteAttraction(parcId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { attractionId: string; quantite: number }) => {
      const { error } = await supabase
        .from('parc_attractions')
        .update({ quantite: params.quantite })
        .eq('id', params.attractionId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['attractions-parc', parcId] });
    },
  });
}
