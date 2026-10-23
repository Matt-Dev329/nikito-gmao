import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useFormationFilter } from '@/hooks/useFormation';
import type { StatutIncident } from '@/types/database';

// Jointure souple : un ticket signalé avec un équipement saisi à la main n'a pas
// d'équipement ; son parc vient alors du déclarant (champs calculés parc_ticket*)
const SELECT_INCIDENTS = `*, parc_ticket, parc_ticket_code,
          equipements(code, libelle, parc_id, parcs(code, nom), zones(nom), categories_equipement(nom, activite)),
          niveaux_priorite(code, nom, sla_h, couleur_hex),
          externe_fournisseur:fournisseurs!incidents_externe_fournisseur_id_fkey(nom, contact_tel, contact_nom),
          attente_commande:commandes!incidents_attente_piece_commande_id_fkey(numero, statut)`;

/** Tickets publiés (hors tickets en attente de validation, cf useTicketsAValider) */
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
        .select(SELECT_INCIDENTS)
        .eq('est_formation', estFormation)
        .or('validation_manager.is.null,validation_manager.neq.en_attente')
        .order('declare_le', { ascending: false });

      if (filtres?.parcId) {
        q = q.eq('parc_ticket', filtres.parcId);
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

/** Nombre de tickets ouverts (à faire, en cours, attente de pièce, extérieur) par parc */
export function useNombreTicketsParParc() {
  const { estFormation } = useFormationFilter();
  return useQuery({
    queryKey: ['incidents', 'nombre-par-parc', estFormation],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('incidents')
        .select('parc_ticket')
        .eq('est_formation', estFormation)
        .or('validation_manager.is.null,validation_manager.neq.en_attente')
        .in('statut', ['ouvert', 'assigne', 'en_pause', 'en_cours']);
      if (error) throw error;
      const parParc = new Map<string, number>();
      ((data ?? []) as { parc_ticket: string | null }[]).forEach((i) => {
        if (i.parc_ticket) parParc.set(i.parc_ticket, (parParc.get(i.parc_ticket) ?? 0) + 1);
      });
      return { total: (data ?? []).length, parParc };
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
          `*, parc_ticket, parc_ticket_code,
          equipements(*, parcs(code, nom), zones(nom), categories_equipement(nom, activite)),
          niveaux_priorite(*),
          interventions(*, pieces_utilisees(*, pieces_detachees(*))),
          externe_fournisseur:fournisseurs!incidents_externe_fournisseur_id_fkey(nom, contact_tel, contact_nom),
          attente_commande:commandes!incidents_attente_piece_commande_id_fkey(numero, statut)`
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

/** Tickets créés par le staff ou un manager non principal, en attente de validation */
export function useTicketsAValider(actif: boolean) {
  const { estFormation } = useFormationFilter();
  return useQuery({
    queryKey: ['incidents', 'a_valider', estFormation],
    enabled: actif,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('incidents')
        .select(SELECT_INCIDENTS)
        .eq('est_formation', estFormation)
        .eq('validation_manager', 'en_attente')
        .neq('statut', 'annule')
        .order('declare_le', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/** Valide un ticket : il apparaît alors dans Opérations (RPC valider_ticket) */
export function useValiderTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (incidentId: string) => {
      const { error } = await supabase.rpc('valider_ticket', { p_incident_id: incidentId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['incidents'] }),
  });
}

/** Supprime (annule) un ticket avec un motif obligatoire (RPC supprimer_ticket) */
export function useSupprimerTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ incidentId, motif }: { incidentId: string; motif: string }) => {
      const { error } = await supabase.rpc('supprimer_ticket', { p_incident_id: incidentId, p_motif: motif });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['incidents'] }),
  });
}

/** Clôture rapide (chef d'équipe, directeurs de parc) : justification obligatoire, RPC cloturer_ticket_rapide */
export function useCloturerTicketRapide() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ incidentId, justification, testActivite }: { incidentId: string; justification: string; testActivite: boolean }) => {
      const { error } = await supabase.rpc('cloturer_ticket_rapide', {
        p_incident_id: incidentId,
        p_justification: justification,
        p_test_activite: testActivite,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['incidents'] }),
  });
}

/** Réouverture d'un ticket résolu / fermé (chef d'équipe uniquement) : motif obligatoire, RPC rouvrir_ticket */
export function useRouvrirTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ incidentId, motif }: { incidentId: string; motif: string }) => {
      const { error } = await supabase.rpc('rouvrir_ticket', { p_incident_id: incidentId, p_motif: motif });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incidents'] });
      qc.invalidateQueries({ queryKey: ['sidebar-badges'] });
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

/**
 * Démarre (ou reprend) l'intervention d'un ticket : crée l'intervention si
 * aucune n'est ouverte, passe le ticket « en cours » et lance le chrono.
 * Idempotent côté base (RPC demarrer_intervention).
 */
export function useDemarrerIntervention() {
  const qc = useQueryClient();
  return useMutation({
    // Photo AVANT obligatoire (sauf reprise d'une intervention qui l'a déjà)
    mutationFn: async ({ incidentId, photoAvant }: { incidentId: string; photoAvant: string | null }) => {
      const { data, error } = await supabase.rpc('demarrer_intervention_photo', {
        p_incident_id: incidentId,
        p_photo_avant: photoAvant,
      });
      if (error) throw error;
      return data as { intervention_id: string; debut: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incidents'] });
    },
  });
}

// --- Intervenant extérieur ---------------------------------------------------

export function useConfierIntervenantExterieur() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      incidentId: string;
      fournisseurId: string | null;
      nom: string;
      datePrevue: string;
      commentaire: string;
    }) => {
      const { error } = await supabase.rpc('confier_intervenant_exterieur', {
        p_incident_id: p.incidentId,
        p_fournisseur_id: p.fournisseurId,
        p_nom: p.nom || null,
        p_date_prevue: p.datePrevue || null,
        p_commentaire: p.commentaire || null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['incidents'] }),
  });
}

export function useReprendreTicketEnInterne() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (incidentId: string) => {
      const { error } = await supabase.rpc('reprendre_ticket_en_interne', { p_incident_id: incidentId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['incidents'] }),
  });
}

export function useCloturerTicketExterieur() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { incidentId: string; compteRendu: string; testActivite: boolean }) => {
      const { error } = await supabase.rpc('cloturer_ticket_exterieur', {
        p_incident_id: p.incidentId,
        p_compte_rendu: p.compteRendu,
        p_test_activite: p.testActivite,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['incidents'] }),
  });
}

// --- Pièce en attente --------------------------------------------------------

export function useMettreEnAttentePiece() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { incidentId: string; detail: string; commandeId: string | null }) => {
      const { error } = await supabase.rpc('mettre_en_attente_piece', {
        p_incident_id: p.incidentId,
        p_detail: p.detail || null,
        p_commande_id: p.commandeId,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['incidents'] }),
  });
}

export function useLeverAttentePiece() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (incidentId: string) => {
      const { error } = await supabase.rpc('lever_attente_piece', { p_incident_id: incidentId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['incidents'] }),
  });
}
