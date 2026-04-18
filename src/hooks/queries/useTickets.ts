import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useFormationFilter } from '@/hooks/useFormation';
import type { StatutIncident } from '@/types/database';

export function useIncidents(filtres?: {
  parcId?: string;
  statuts?: StatutIncident[];
  technicienId?: string;
}) {
  const { estFormation } = useFormationFilter();
  return useQuery({
    queryKey: ['incidents', filtres, estFormation],
    queryFn: async () => {
      let q = supabase
        .from('incidents')
        .select(
          `*,
          equipements!inner(code, libelle, parc_id, parcs(code, nom), zones(nom), categories_equipement(nom)),
          niveaux_priorite(code, nom, sla_h, couleur_hex)`
        )
        .eq('est_formation', estFormation)
        .order('declare_le', { ascending: false });

      if (filtres?.parcId) {
        q = q.eq('equipements.parc_id', filtres.parcId);
      }
      if (filtres?.statuts && filtres.statuts.length > 0) {
        q = q.in('statut', filtres.statuts);
      }

      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}

export function useIncident(numeroBT: string | undefined) {
  return useQuery({
    queryKey: ['incidents', 'detail', numeroBT],
    queryFn: async () => {
      if (!numeroBT) return null;
      const { data, error } = await supabase
        .from('incidents')
        .select(
          `*,
          equipements(*, parcs(code, nom), zones(nom), categories_equipement(nom)),
          niveaux_priorite(*),
          interventions(*, utilisateurs!technicien_id(prenom, nom, trigramme),
            pieces_utilisees(*, pieces_detachees(*)))`
        )
        .eq('numero_bt', numeroBT)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!numeroBT,
  });
}

export function useStock() {
  const { estFormation } = useFormationFilter();
  return useQuery({
    queryKey: ['stock', estFormation],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pieces_detachees')
        .select('*, fournisseurs(nom, contact_tel)')
        .eq('est_formation', estFormation)
        .order('nom');
      if (error) throw error;
      return data;
    },
  });
}

export function useStockBas() {
  const { estFormation } = useFormationFilter();
  return useQuery({
    queryKey: ['stock', 'bas', estFormation],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pieces_detachees')
        .select('*, fournisseurs(nom, contact_tel)')
        .eq('est_formation', estFormation)
        .lt('stock_actuel', 'stock_min');
      if (error) throw error;
      return data;
    },
  });
}

export function useFiches5Pourquoi(statut?: 'ouvert' | 'valide' | 'audit_en_cours' | 'clos') {
  const { estFormation } = useFormationFilter();
  return useQuery({
    queryKey: ['5_pourquoi', statut, estFormation],
    queryFn: async () => {
      let q = supabase
        .from('fiches_5_pourquoi')
        .select(`*, equipements(code, libelle, parc_id, parcs(code, nom)), incidents(numero_bt, titre)`)
        .eq('est_formation', estFormation)
        .order('ouvert_le', { ascending: false });
      if (statut) q = q.eq('statut', statut);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });
}
