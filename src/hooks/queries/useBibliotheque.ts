import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import type { PointBibliothequeAvecJoins, TypeControle, AssigneA } from '@/types/database';

export function useBibliothequePoints() {
  return useQuery({
    queryKey: ['bibliotheque_points'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bibliotheque_points')
        .select('*, categories_equipement(id, nom)')
        .order('ordre');
      if (error) throw error;
      return (data ?? []) as PointBibliothequeAvecJoins[];
    },
  });
}

export function useCreerPoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      categorie_id: string;
      libelle: string;
      description?: string | null;
      type_controle: TypeControle;
      assigne_a: AssigneA;
      obligation_constructeur?: boolean;
      norme_associee?: string | null;
      bloquant_si_ko?: boolean;
      photo_obligatoire?: boolean;
      ordre?: number;
    }) => {
      const { data, error } = await supabase
        .from('bibliotheque_points')
        .insert({
          ...payload,
          description: payload.description || null,
          norme_associee: payload.norme_associee || null,
          obligation_constructeur: payload.obligation_constructeur ?? false,
          bloquant_si_ko: payload.bloquant_si_ko ?? false,
          photo_obligatoire: payload.photo_obligatoire ?? false,
          ordre: payload.ordre ?? 99,
          verrouille: false,
          actif: true,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bibliotheque_points'] });
    },
  });
}

export function useModifierPoint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: {
      id: string;
      libelle?: string;
      description?: string | null;
      type_controle?: TypeControle;
      assigne_a?: AssigneA;
      norme_associee?: string | null;
      bloquant_si_ko?: boolean;
      photo_obligatoire?: boolean;
      ordre?: number;
      actif?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('bibliotheque_points')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bibliotheque_points'] });
    },
  });
}
