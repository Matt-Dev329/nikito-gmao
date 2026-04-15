import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

// ============================================================
// Query hooks · Référentiel
// ============================================================

export function useParcs() {
  return useQuery({
    queryKey: ['parcs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parcs')
        .select('*')
        .eq('actif', true)
        .order('code');
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
        .select('*, parcs(code, nom), categories_equipement(nom, criticite_defaut), zones(nom)')
        .eq('statut', 'actif');
      if (parcId) q = q.eq('parc_id', parcId);
      const { data, error } = await q.order('code');
      if (error) throw error;
      return data;
    },
  });
}
