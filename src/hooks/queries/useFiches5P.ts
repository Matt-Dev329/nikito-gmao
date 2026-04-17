import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { Fiche5PourquoiAvecJoins, Statut5Pourquoi } from '@/types/database';

const SELECT_FICHE =
  '*, equipements(code, libelle, parc_id, parcs(code, nom)), incidents(numero_bt, titre)';

export function useFiches5P() {
  return useQuery({
    queryKey: ['fiches_5_pourquoi'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fiches_5_pourquoi')
        .select(SELECT_FICHE)
        .order('ouvert_le', { ascending: false });
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

export function useCreerFiche5P() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      incident_id: string;
      equipement_id: string;
      ouvert_par_id: string;
    }) => {
      const { data, error } = await supabase
        .from('fiches_5_pourquoi')
        .insert({
          incident_id: payload.incident_id,
          equipement_id: payload.equipement_id,
          ouvert_par_id: payload.ouvert_par_id,
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
      q1?: string | null;
      q2?: string | null;
      q3?: string | null;
      q4?: string | null;
      q5?: string | null;
      cause_racine?: string | null;
      contre_mesure?: string | null;
      type_action?: string | null;
      statut?: Statut5Pourquoi;
      validee_par_id?: string | null;
      validee_le?: string | null;
      audit_90j_le?: string | null;
      audit_resultat?: string | null;
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
