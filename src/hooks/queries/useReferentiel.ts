import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useFormationFilter } from '@/hooks/useFormation';
import type { EquipementAvecJoins, StatutEquipement } from '@/types/database';

// ============================================================
// Query hooks · Référentiel
// ============================================================

export function useParcs() {
  const { estFormation } = useFormationFilter();
  return useQuery({
    queryKey: ['parcs', estFormation],
    queryFn: async () => {
      let q = supabase
        .from('parcs')
        .select('*')
        .eq('actif', true);
      if (!estFormation) {
        q = q.neq('code', 'ECO');
      }
      const { data, error } = await q.order('code');
      if (error) throw error;
      return data;
    },
  });
}

export function useParc(parcId: string | undefined) {
  return useQuery({
    queryKey: ['parcs', parcId],
    queryFn: async () => {
      if (!parcId) return null;
      const { data, error } = await supabase
        .from('parcs')
        .select('*')
        .eq('id', parcId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!parcId,
  });
}

export function useCategoriesEquipement() {
  return useQuery({
    queryKey: ['categories_equipement'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories_equipement')
        .select('*')
        .order('nom');
      if (error) throw error;
      return data;
    },
  });
}

export function useZonesParc(parcId?: string) {
  return useQuery({
    queryKey: ['zones', parcId],
    queryFn: async () => {
      if (!parcId) return [];
      const { data, error } = await supabase
        .from('zones')
        .select('*')
        .eq('parc_id', parcId)
        .order('ordre');
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!parcId,
  });
}

export function useFournisseurs() {
  return useQuery({
    queryKey: ['fournisseurs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fournisseurs')
        .select('*')
        .eq('actif', true)
        .order('nom');
      if (error) throw error;
      return data;
    },
  });
}

export function useEquipements(parcId?: string) {
  return useQuery({
    queryKey: ['equipements', parcId],
    queryFn: async () => {
      let q = supabase
        .from('equipements')
        .select('*, parcs(code, nom), categories_equipement(nom, criticite_defaut), zones(nom)');
      if (parcId) q = q.eq('parc_id', parcId);
      const { data, error } = await q.order('code');
      if (error) throw error;
      return (data ?? []) as EquipementAvecJoins[];
    },
  });
}

export function useCreerEquipement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      parc_id: string;
      categorie_id: string;
      zone_id?: string | null;
      code: string;
      libelle: string;
      numero_serie?: string | null;
      date_mise_service?: string | null;
      date_fin_garantie?: string | null;
      statut?: StatutEquipement;
      a_surveiller?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('equipements')
        .insert({
          ...payload,
          zone_id: payload.zone_id || null,
          numero_serie: payload.numero_serie || null,
          date_mise_service: payload.date_mise_service || null,
          date_fin_garantie: payload.date_fin_garantie || null,
          statut: payload.statut ?? 'actif',
          a_surveiller: payload.a_surveiller ?? false,
        })
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['equipements'] });
    },
  });
}

export function useModifierEquipement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: {
      id: string;
      parc_id?: string;
      categorie_id?: string;
      zone_id?: string | null;
      code?: string;
      libelle?: string;
      numero_serie?: string | null;
      date_mise_service?: string | null;
      date_fin_garantie?: string | null;
      statut?: StatutEquipement;
      a_surveiller?: boolean;
    }) => {
      const { data, error } = await supabase
        .from('equipements')
        .update(payload)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['equipements'] });
    },
  });
}

export function useImporterEquipements() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rows: Array<{
      parc_id: string;
      categorie_id: string;
      code: string;
      libelle: string;
      numero_serie?: string | null;
      date_mise_service?: string | null;
    }>) => {
      const { data, error } = await supabase
        .from('equipements')
        .insert(rows.map((r) => ({
          ...r,
          numero_serie: r.numero_serie || null,
          date_mise_service: r.date_mise_service || null,
        })))
        .select('id');
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['equipements'] });
    },
  });
}
