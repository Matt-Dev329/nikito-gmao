import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  const { estFormation } = useFormationFilter();
  return useQuery({
    queryKey: ['incidents', 'detail', numeroBT, estFormation],
    queryFn: async () => {
      if (!numeroBT) return null;
      const { data, error } = await supabase
        .from('incidents')
        .select(
          `*,
          equipements(*, parcs(code, nom), zones(nom), categories_equipement(nom)),
          niveaux_priorite(*),
          interventions(*, pieces_utilisees(*, pieces_detachees(*)))`
        )
        .eq('numero_bt', numeroBT)
        .eq('est_formation', estFormation)
        .maybeSingle();
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

export function useTechniciens() {
  return useQuery({
    queryKey: ['techniciens_actifs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('utilisateurs')
        .select('id, prenom, nom, trigramme, roles!inner(code)')
        .eq('actif', true)
        .in('roles.code', ['technicien', 'chef_maintenance', 'directeur_parc'])
        .order('prenom');
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; prenom: string; nom: string; trigramme: string | null }>;
    },
  });
}

export function useReassignerIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { incidentId: string; nouveauTechnicienId: string }) => {
      const { data, error } = await supabase.rpc('reassigner_incident', {
        p_incident_id: params.incidentId,
        p_nouveau_technicien_id: params.nouveauTechnicienId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incidents'] });
    },
  });
}

export function useMettreEnPauseIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { incidentId: string; motif: string | null }) => {
      const { data, error } = await supabase.rpc('mettre_en_pause_incident', {
        p_incident_id: params.incidentId,
        p_motif: params.motif,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incidents'] });
    },
  });
}

export function useReprendreIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (incidentId: string) => {
      const { data, error } = await supabase.rpc('reprendre_incident', {
        p_incident_id: incidentId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incidents'] });
    },
  });
}

export function useValiderBrouillonIncident() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (incidentId: string) => {
      const { data, error } = await supabase.rpc('valider_brouillon_incident', {
        p_incident_id: incidentId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incidents'] });
    },
  });
}
