import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useFormationFilter } from '@/hooks/useFormation';
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
  photo_url?: string | null;
}

export interface ItemSaisiMensuel extends ItemSaisi {
  point_libelle_snapshot: string;
  point_categorie_snapshot: string;
  point_type_controle_snapshot: string;
}

export function useValiderControle() {
  const qc = useQueryClient();
  const { estFormation } = useFormationFilter();
  return useMutation({
    mutationFn: async (params: {
      parc_id: string;
      type: TypeControle;
      date_planifiee: string;
      realise_par_id: string;
      realise_par_nom: string;
      realise_par_role: string;
      items: ItemSaisi[];
    }) => {
      const now = new Date().toISOString();

      const { data: existant } = await supabase
        .from('controles')
        .select('id')
        .eq('parc_id', params.parc_id)
        .eq('type', params.type)
        .eq('date_planifiee', params.date_planifiee)
        .eq('est_formation', estFormation)
        .in('statut', ['a_faire', 'en_cours'])
        .maybeSingle();

      let controleId: string;

      if (existant) {
        const { data: updated, error: errUpd } = await supabase
          .from('controles')
          .update({
            date_demarrage: now,
            date_validation: now,
            realise_par_id: params.realise_par_id,
            realise_par_nom: params.realise_par_nom,
            realise_par_role: params.realise_par_role,
            valide_par_id: params.realise_par_id,
            statut: 'valide',
          })
          .eq('id', existant.id)
          .eq('est_formation', estFormation)
          .select('id')
          .single();
        if (errUpd) throw errUpd;
        controleId = updated.id;
      } else {
        const { data: created, error: errCtrl } = await supabase
          .from('controles')
          .insert({
            parc_id: params.parc_id,
            type: params.type,
            date_planifiee: params.date_planifiee,
            date_demarrage: now,
            date_validation: now,
            realise_par_id: params.realise_par_id,
            realise_par_nom: params.realise_par_nom,
            realise_par_role: params.realise_par_role,
            valide_par_id: params.realise_par_id,
            statut: 'valide',
            est_formation: estFormation,
          })
          .select('id')
          .single();
        if (errCtrl) throw errCtrl;
        controleId = created.id;
      }

      const rows = params.items.map((item) => ({
        controle_id: controleId,
        point_id: item.point_id,
        etat: item.etat,
        commentaire: item.commentaire ?? null,
        photo_url: item.photo_url ?? null,
        saisi_par_id: params.realise_par_id,
      }));

      const { error: errItems } = await supabase
        .from('controle_items')
        .insert(rows);

      if (errItems) throw errItems;
      return { id: controleId };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['controles'] });
      qc.invalidateQueries({ queryKey: ['manager_parc_stats'] });
      qc.invalidateQueries({ queryKey: ['historique_controles'] });
    },
  });
}

export function useValiderControleMensuel() {
  const qc = useQueryClient();
  const { estFormation } = useFormationFilter();
  return useMutation({
    mutationFn: async (params: {
      parc_id: string;
      date_planifiee: string;
      realise_par_id: string;
      realise_par_nom: string;
      realise_par_role: string;
      signature_url: string;
      meta: {
        binome_nom: string;
        binome_signature_url: string;
      };
      items: ItemSaisiMensuel[];
    }) => {
      const now = new Date().toISOString();

      const { data: existant } = await supabase
        .from('controles')
        .select('id')
        .eq('parc_id', params.parc_id)
        .eq('type', 'mensuel')
        .eq('date_planifiee', params.date_planifiee)
        .eq('est_formation', estFormation)
        .in('statut', ['a_faire', 'en_cours'])
        .maybeSingle();

      let controleId: string;

      const controlePayload = {
        date_demarrage: now,
        date_validation: now,
        realise_par_id: params.realise_par_id,
        realise_par_nom: params.realise_par_nom,
        realise_par_role: params.realise_par_role,
        valide_par_id: params.realise_par_id,
        signature_url: params.signature_url,
        signature_at: now,
        meta: params.meta,
        statut: 'valide' as const,
      };

      if (existant) {
        const { data: updated, error: errUpd } = await supabase
          .from('controles')
          .update(controlePayload)
          .eq('id', existant.id)
          .eq('est_formation', estFormation)
          .select('id')
          .single();
        if (errUpd) throw errUpd;
        controleId = updated.id;
      } else {
        const { data: created, error: errCtrl } = await supabase
          .from('controles')
          .insert({
            parc_id: params.parc_id,
            type: 'mensuel' as const,
            date_planifiee: params.date_planifiee,
            est_formation: estFormation,
            ...controlePayload,
          })
          .select('id')
          .single();
        if (errCtrl) throw errCtrl;
        controleId = created.id;
      }

      const rows = params.items.map((item) => ({
        controle_id: controleId,
        point_id: item.point_id,
        etat: item.etat,
        commentaire: item.commentaire ?? null,
        photo_url: item.photo_url ?? null,
        saisi_par_id: params.realise_par_id,
        point_libelle_snapshot: item.point_libelle_snapshot,
        point_categorie_snapshot: item.point_categorie_snapshot,
        point_type_controle_snapshot: item.point_type_controle_snapshot,
      }));

      const { error: errItems } = await supabase
        .from('controle_items')
        .insert(rows);

      if (errItems) throw errItems;
      return { id: controleId };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['controles'] });
      qc.invalidateQueries({ queryKey: ['manager_parc_stats'] });
      qc.invalidateQueries({ queryKey: ['historique_controles'] });
    },
  });
}
