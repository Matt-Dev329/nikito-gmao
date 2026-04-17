import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type {
  Fiche5PourquoiAvecJoins,
  Statut5Pourquoi,
  StandardEvolutifAvecJoins,
  StatutStandardEvolutif,
} from '@/types/database';

const SELECT_FICHE = '*, parcs(code, nom), equipements(code, libelle)';

export function useFiches5P() {
  return useQuery({
    queryKey: ['fiches_5_pourquoi'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fiches_5_pourquoi')
        .select(SELECT_FICHE)
        .order('cree_le', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Fiche5PourquoiAvecJoins[];
    },
  });
}

export function useFiche5P(id: string | undefined) {
  return useQuery({
    queryKey: ['fiches_5_pourquoi', 'detail', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('fiches_5_pourquoi')
        .select(SELECT_FICHE)
        .eq('id', id)
        .maybeSingle();
      if (error) throw error;
      return data as Fiche5PourquoiAvecJoins | null;
    },
    enabled: !!id,
  });
}

export function useStandardsEvolutifs(fiche5pId: string | undefined) {
  return useQuery({
    queryKey: ['standards_evolutifs', fiche5pId],
    queryFn: async () => {
      if (!fiche5pId) return [];
      const { data, error } = await supabase
        .from('standards_evolutifs')
        .select('*, utilisateurs!responsable_id(prenom, nom)')
        .eq('fiche_5p_id', fiche5pId)
        .order('cree_le');
      if (error) throw error;
      return (data ?? []) as StandardEvolutifAvecJoins[];
    },
    enabled: !!fiche5pId,
  });
}

export function useCreerFiche5P() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      parc_id: string;
      equipement_id?: string | null;
      titre: string;
      description?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('fiches_5_pourquoi')
        .insert({
          parc_id: payload.parc_id,
          equipement_id: payload.equipement_id || null,
          titre: payload.titre,
          description: payload.description || null,
          statut: 'ouvert',
        })
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fiches_5_pourquoi'] });
    },
  });
}

export function useModifierFiche5P() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: {
      id: string;
      titre?: string;
      description?: string | null;
      pourquoi_1?: string | null;
      pourquoi_2?: string | null;
      pourquoi_3?: string | null;
      pourquoi_4?: string | null;
      pourquoi_5?: string | null;
      cause_racine?: string | null;
      statut?: Statut5Pourquoi;
      cloture_le?: string | null;
      cloture_par_id?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('fiches_5_pourquoi')
        .update(payload)
        .eq('id', id)
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['fiches_5_pourquoi'] });
      qc.invalidateQueries({ queryKey: ['fiches_5_pourquoi', 'detail', variables.id] });
    },
  });
}

export function useCreerStandard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      fiche_5p_id: string;
      description: string;
      responsable_id?: string | null;
      deadline?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('standards_evolutifs')
        .insert({
          fiche_5p_id: payload.fiche_5p_id,
          description: payload.description,
          responsable_id: payload.responsable_id || null,
          deadline: payload.deadline || null,
          statut: 'a_faire',
        })
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['standards_evolutifs', variables.fiche_5p_id] });
    },
  });
}

export function useModifierStandard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, fiche_5p_id, ...payload }: {
      id: string;
      fiche_5p_id: string;
      description?: string;
      responsable_id?: string | null;
      deadline?: string | null;
      statut?: StatutStandardEvolutif;
    }) => {
      const { data, error } = await supabase
        .from('standards_evolutifs')
        .update(payload)
        .eq('id', id)
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ['standards_evolutifs', variables.fiche_5p_id] });
    },
  });
}
