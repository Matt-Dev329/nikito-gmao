import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface PointApplicable {
  parc_id: string;
  parc_code: string;
  parc_nom: string;
  point_id: string;
  point_libelle: string;
  type_controle: string;
  assigne_a: string | null;
  bloquant: boolean;
  photo_obligatoire: boolean;
  ordre: number | null;
  categorie_id: string;
  categorie_nom: string;
  actif_pour_parc: boolean;
}

export function usePointsPourParc(parcId: string | undefined) {
  return useQuery({
    queryKey: ['points_parc', parcId],
    queryFn: async () => {
      if (!parcId) return [];
      const { data, error } = await supabase
        .from('v_points_applicables_par_parc')
        .select('*')
        .eq('parc_id', parcId)
        .order('categorie_nom')
        .order('type_controle')
        .order('ordre');
      if (error) throw error;
      return data as PointApplicable[];
    },
    enabled: !!parcId,
  });
}

export function usePointsPourParcEtCategorie(parcId: string | undefined, categorieId: string | undefined) {
  return useQuery({
    queryKey: ['points_parc', parcId, 'categorie', categorieId],
    queryFn: async () => {
      if (!parcId || !categorieId) return [];
      const { data, error } = await supabase
        .from('v_points_applicables_par_parc')
        .select('*')
        .eq('parc_id', parcId)
        .eq('categorie_id', categorieId)
        .order('type_controle')
        .order('ordre');
      if (error) throw error;
      return data as PointApplicable[];
    },
    enabled: !!parcId && !!categorieId,
  });
}

export function useTogglePointActif(parcId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { pointId: string; actif: boolean; raison?: string }) => {
      if (params.actif) {
        const { error } = await supabase
          .from('parc_points_actifs')
          .delete()
          .eq('parc_id', parcId)
          .eq('point_id', params.pointId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('parc_points_actifs')
          .upsert({
            parc_id: parcId,
            point_id: params.pointId,
            actif: false,
            raison: params.raison || null,
          }, { onConflict: 'parc_id,point_id' });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['points_parc', parcId] });
    },
  });
}
