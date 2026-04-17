import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { TypeControle, EtatControleItem } from '@/types/database';

export interface PointCharge {
  point_id: string;
  libelle: string;
  ordre: number;
  categorie_id: string;
  categorie_nom: string;
  bloquant: boolean;
  photo_obligatoire: boolean;
  norme_associee?: string | null;
}

export function usePointsControle(parcId: string | undefined, typeControle: TypeControle) {
  return useQuery({
    queryKey: ['points_controle', parcId, typeControle],
    queryFn: async () => {
      if (!parcId) return [];
      const { data, error } = await supabase
        .from('v_points_applicables_par_parc')
        .select('*')
        .eq('parc_id', parcId)
        .eq('type_controle', typeControle)
        .eq('actif_pour_parc', true)
        .order('categorie_nom')
        .order('ordre');
      if (error) throw error;

      return (data ?? []).map((d: Record<string, unknown>) => ({
        point_id: d.point_id as string,
        libelle: d.point_libelle as string,
        ordre: (d.ordre as number) ?? 0,
        categorie_id: d.categorie_id as string,
        categorie_nom: d.categorie_nom as string,
        bloquant: (d.bloquant as boolean) ?? false,
        photo_obligatoire: (d.photo_obligatoire as boolean) ?? false,
      })) as PointCharge[];
    },
    enabled: !!parcId,
  });
}

export interface ItemSaisi {
  point_id: string;
  etat: EtatControleItem;
  commentaire?: string | null;
}

export function useValiderControle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      parc_id: string;
      type: TypeControle;
      date_planifiee: string;
      realise_par_id: string;
      items: ItemSaisi[];
    }) => {
      const { data: controle, error: errCtrl } = await supabase
        .from('controles')
        .insert({
          parc_id: params.parc_id,
          type: params.type,
          date_planifiee: params.date_planifiee,
          date_demarrage: new Date().toISOString(),
          date_validation: new Date().toISOString(),
          realise_par_id: params.realise_par_id,
          valide_par_id: params.realise_par_id,
          statut: 'valide',
        })
        .select('id')
        .single();

      if (errCtrl) throw errCtrl;

      const rows = params.items.map((item) => ({
        controle_id: controle.id,
        point_id: item.point_id,
        etat: item.etat,
        commentaire: item.commentaire ?? null,
        saisi_par_id: params.realise_par_id,
      }));

      const { error: errItems } = await supabase
        .from('controle_items')
        .insert(rows);

      if (errItems) throw errItems;
      return controle;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['controles'] });
      qc.invalidateQueries({ queryKey: ['manager_parc_stats'] });
    },
  });
}
