import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export interface ParcPhase {
  id: string;
  parc_id: string;
  phase: string;
  date_debut: string;
  date_fin: string | null;
  date_prevu: string | null;
  notes: string | null;
  cree_par_id: string | null;
  cree_le: string;
}

export interface Commission {
  id: string;
  parc_id: string;
  type_commission: string;
  date_visite: string;
  date_pv: string | null;
  numero_pv: string | null;
  pv_url: string | null;
  president_commission: string | null;
  presents_externes: Array<{ nom: string; organisme: string; role: string }>;
  presents_internes: string[];
  resultat: string | null;
  prochaine_visite_prevue: string | null;
  notes: string | null;
  cree_par_id: string | null;
  modifie_par_id: string | null;
  cree_le: string;
  modifie_le: string;
  parcs?: { code: string; nom: string } | null;
}

export interface Prescription {
  id: string;
  commission_id: string;
  parc_id: string;
  numero_prescription: string | null;
  categorie: string;
  gravite: string;
  reglement_applicable: string | null;
  intitule: string;
  description: string | null;
  photo_url: string | null;
  delai_levee: string | null;
  responsable_id: string | null;
  statut: string;
  date_levee_effective: string | null;
  preuve_levee_url: string | null;
  preuve_levee_notes: string | null;
  validee_par_commission_id: string | null;
  cout_estime: number | null;
  cout_reel: number | null;
  cree_par_id: string | null;
  modifie_par_id: string | null;
  cree_le: string;
  modifie_le: string;
  extrait_par_ia?: boolean | null;
  extraction_id?: string | null;
  confiance_extraction?: number | null;
  parcs?: { code: string; nom: string } | null;
  responsable?: { id: string; prenom: string; nom: string } | null;
}

export interface ExtractionPv {
  id: string;
  commission_id: string;
  document_id: string | null;
  parc_id: string;
  pv_url: string;
  pv_filename: string | null;
  statut: string;
  nb_prescriptions_extraites: number;
  nb_prescriptions_validees: number;
  nb_prescriptions_rejetees: number;
  raw_response_claude: Record<string, unknown> | null;
  duree_traitement_ms: number | null;
  cout_estime: number | null;
  erreur_message: string | null;
  cree_par_id: string | null;
  cree_le: string;
  validee_le: string | null;
  commissions_securite?: { date_visite: string; type_commission: string; parcs?: { code: string; nom: string } | null } | null;
}

export interface DocumentChantier {
  id: string;
  parc_id: string;
  categorie: string;
  intitule: string;
  fichier_url: string;
  date_document: string | null;
  emis_par: string | null;
  est_obligatoire_ouverture: boolean;
  commission_id: string | null;
  prescription_id: string | null;
  cree_par_id: string | null;
  cree_le: string;
  parcs?: { code: string; nom: string } | null;
}

export interface ActeurChantier {
  id: string;
  parc_id: string;
  type_acteur: string;
  nom_societe: string;
  contact_nom: string | null;
  contact_email: string | null;
  contact_tel: string | null;
  date_debut_mission: string | null;
  date_fin_mission: string | null;
  notes: string | null;
  cree_par_id: string | null;
  cree_le: string;
  parcs?: { code: string; nom: string } | null;
}

export interface NotificationConformite {
  id: string;
  destinataire_id: string;
  parc_id: string | null;
  type_notification: string;
  prescription_id: string | null;
  commission_id: string | null;
  titre: string;
  message: string | null;
  lu: boolean;
  lu_le: string | null;
  cree_le: string;
}

// Phase actuelle par parc (view)
export function useParcsPhaseActuelle() {
  return useQuery({
    queryKey: ['conformite', 'parcs-phase-actuelle'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('v_parcs_phase_actuelle')
        .select('*');
      if (error) throw error;
      return data as Array<{ parc_id: string; phase: string; date_debut: string; date_fin: string | null; date_prevu: string | null }>;
    },
  });
}

// Toutes les phases d'un parc
export function usePhasesParc(parcId: string | undefined) {
  return useQuery({
    queryKey: ['conformite', 'phases', parcId],
    enabled: !!parcId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('parcs_phases')
        .select('*')
        .eq('parc_id', parcId!)
        .order('date_debut', { ascending: true });
      if (error) throw error;
      return data as ParcPhase[];
    },
  });
}

// Commissions
export function useCommissions(parcId?: string) {
  return useQuery({
    queryKey: ['conformite', 'commissions', parcId ?? 'all'],
    queryFn: async () => {
      let q = supabase
        .from('commissions_securite')
        .select('*, parcs(code, nom)')
        .order('date_visite', { ascending: false });
      if (parcId) q = q.eq('parc_id', parcId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Commission[];
    },
  });
}

// Prescriptions
export function usePrescriptions(filters?: { parcId?: string; statut?: string[]; responsableId?: string }) {
  return useQuery({
    queryKey: ['conformite', 'prescriptions', filters],
    queryFn: async () => {
      let q = supabase
        .from('prescriptions_securite')
        .select('*, parcs(code, nom), responsable:utilisateurs!prescriptions_securite_responsable_id_fkey(id, prenom, nom)')
        .order('cree_le', { ascending: false });
      if (filters?.parcId) q = q.eq('parc_id', filters.parcId);
      if (filters?.statut && filters.statut.length > 0) q = q.in('statut', filters.statut);
      if (filters?.responsableId) q = q.eq('responsable_id', filters.responsableId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Prescription[];
    },
  });
}

// KPI conformite
export function useConformiteKpi() {
  return useQuery({
    queryKey: ['conformite', 'kpi'],
    queryFn: async () => {
      const [parcsRes, ouvertesRes, retardRes, prochaineRes] = await Promise.all([
        supabase
          .from('v_parcs_phase_actuelle')
          .select('parc_id', { count: 'exact', head: true })
          .eq('phase', 'vie_courante'),
        supabase
          .from('prescriptions_securite')
          .select('id', { count: 'exact', head: true })
          .in('statut', ['a_lever', 'en_cours']),
        supabase
          .from('prescriptions_securite')
          .select('id', { count: 'exact', head: true })
          .in('statut', ['a_lever', 'en_cours'])
          .lt('delai_levee', new Date().toISOString().slice(0, 10)),
        supabase
          .from('commissions_securite')
          .select('date_visite')
          .gte('date_visite', new Date().toISOString().slice(0, 10))
          .order('date_visite', { ascending: true })
          .limit(1),
      ]);

      return {
        parcsExploitation: parcsRes.count ?? 0,
        reservesOuvertes: ouvertesRes.count ?? 0,
        reservesRetard: retardRes.count ?? 0,
        prochaineCommission: prochaineRes.data?.[0]?.date_visite ?? null,
      };
    },
    refetchInterval: 60_000,
  });
}

// Documents
export function useDocumentsChantier(parcId?: string) {
  return useQuery({
    queryKey: ['conformite', 'documents', parcId ?? 'all'],
    queryFn: async () => {
      let q = supabase
        .from('documents_chantier')
        .select('*, parcs(code, nom)')
        .order('cree_le', { ascending: false });
      if (parcId) q = q.eq('parc_id', parcId);
      const { data, error } = await q;
      if (error) throw error;
      return data as DocumentChantier[];
    },
  });
}

// Acteurs
export function useActeursChantier(parcId?: string) {
  return useQuery({
    queryKey: ['conformite', 'acteurs', parcId ?? 'all'],
    queryFn: async () => {
      let q = supabase
        .from('acteurs_chantier')
        .select('*, parcs(code, nom)')
        .order('nom_societe', { ascending: true });
      if (parcId) q = q.eq('parc_id', parcId);
      const { data, error } = await q;
      if (error) throw error;
      return data as ActeurChantier[];
    },
  });
}

// Notifications conformite (non lues)
export function useNotificationsConformite(userId: string | undefined) {
  return useQuery({
    queryKey: ['conformite', 'notifications', userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications_conformite')
        .select('*')
        .eq('destinataire_id', userId!)
        .eq('lu', false)
        .order('cree_le', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as NotificationConformite[];
    },
    refetchInterval: 60_000,
  });
}

// Mutation: update prescription statut
export function useUpdatePrescriptionStatut() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, statut, extras }: { id: string; statut: string; extras?: Record<string, unknown> }) => {
      const { error } = await supabase
        .from('prescriptions_securite')
        .update({ statut, modifie_le: new Date().toISOString(), ...extras })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conformite'] });
    },
  });
}

// Mutation: create commission
export function useCreateCommission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<Commission, 'id' | 'cree_le' | 'modifie_le' | 'parcs'>) => {
      const { data, error } = await supabase
        .from('commissions_securite')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conformite'] });
    },
  });
}

// Mutation: create prescription
export function useCreatePrescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Prescription>) => {
      const { data, error } = await supabase
        .from('prescriptions_securite')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conformite'] });
    },
  });
}

// Mutation: create document
export function useCreateDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<DocumentChantier>) => {
      const { data, error } = await supabase
        .from('documents_chantier')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conformite'] });
    },
  });
}

// Mutation: create acteur
export function useCreateActeur() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<ActeurChantier>) => {
      const { data, error } = await supabase
        .from('acteurs_chantier')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conformite'] });
    },
  });
}

// Mutation: create phase
export function useCreatePhase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { parc_id: string; phase: string; date_debut: string; notes?: string }) => {
      // Close current phase
      await supabase
        .from('parcs_phases')
        .update({ date_fin: new Date().toISOString() })
        .eq('parc_id', payload.parc_id)
        .is('date_fin', null);
      // Insert new phase
      const { data, error } = await supabase
        .from('parcs_phases')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conformite'] });
    },
  });
}

// Extraction IA - fetch one by id
export function useExtraction(id: string | undefined) {
  return useQuery({
    queryKey: ['conformite', 'extraction', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('extractions_pv')
        .select('*, commissions_securite(date_visite, type_commission, parcs(code, nom))')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data as ExtractionPv | null;
    },
  });
}

// Prescriptions d'une extraction (y compris brouillons)
export function usePrescriptionsExtraction(extractionId: string | undefined) {
  return useQuery({
    queryKey: ['conformite', 'prescriptions-extraction', extractionId],
    enabled: !!extractionId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prescriptions_securite')
        .select('*, parcs(code, nom), responsable:utilisateurs!prescriptions_securite_responsable_id_fkey(id, prenom, nom)')
        .eq('extraction_id', extractionId!)
        .order('confiance_extraction', { ascending: false, nullsFirst: false });
      if (error) throw error;
      return data as Prescription[];
    },
  });
}

// Extractions existantes pour un document
export function useExtractionsDocument(documentId: string | undefined) {
  return useQuery({
    queryKey: ['conformite', 'extractions-doc', documentId],
    enabled: !!documentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('extractions_pv')
        .select('*')
        .eq('document_id', documentId!)
        .order('cree_le', { ascending: false });
      if (error) throw error;
      return data as ExtractionPv[];
    },
  });
}

// Mutation: update prescription (champs multiples)
export function useUpdatePrescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Prescription> }) => {
      const { error } = await supabase
        .from('prescriptions_securite')
        .update({ ...patch, modifie_le: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conformite'] });
    },
  });
}

// Mutation: update extraction
export function useUpdateExtraction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<ExtractionPv> }) => {
      const { error } = await supabase
        .from('extractions_pv')
        .update(patch)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conformite'] });
    },
  });
}

// Mark notification as read
export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('notifications_conformite')
        .update({ lu: true, lu_le: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conformite', 'notifications'] });
    },
  });
}
