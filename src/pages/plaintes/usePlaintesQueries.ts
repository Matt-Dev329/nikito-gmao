import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase';
import { useFormationFilter } from '@/hooks/useFormation';

export interface PlainteRow {
  id: string;
  parc_id: string;
  equipement_id: string | null;
  declare_le: string;
  canal: string | null;
  commentaire: string | null;
  saisi_par_id: string | null;
  ticket_genere_id: string | null;
  source: string | null;
  source_externe_id: string | null;
  client_nom: string | null;
  client_email: string | null;
  client_telephone: string | null;
  date_visite: string | null;
  note_globale: number | null;
  categorie: string | null;
  statut: string | null;
  priorite: string | null;
  qualifie_par_id: string | null;
  qualifie_le: string | null;
  motif_qualification: string | null;
  incident_cree_id: string | null;
  est_formation: boolean;
  parcs: { code: string; nom: string } | null;
  equipements: { code: string; libelle: string } | null;
  qualificateur: { prenom: string; nom: string } | null;
  incident_lie: { numero_bt: string; statut: string } | null;
}

export function usePlaintes() {
  const { estFormation } = useFormationFilter();
  return useQuery({
    queryKey: ['plaintes_clients', estFormation],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('plaintes_clients')
        .select(`
          *,
          parcs(code, nom),
          equipements(code, libelle),
          qualificateur:utilisateurs!qualifie_par_id(prenom, nom),
          incident_lie:incidents!incident_cree_id(numero_bt, statut)
        `)
        .eq('est_formation', estFormation)
        .order('declare_le', { ascending: false });
      if (error) throw error;
      return (data ?? []) as PlainteRow[];
    },
  });
}

export function useCreerPlainte() {
  const qc = useQueryClient();
  const { estFormation } = useFormationFilter();
  return useMutation({
    mutationFn: async (payload: {
      parc_id: string;
      equipement_id?: string | null;
      canal?: string | null;
      commentaire?: string | null;
      saisi_par_id?: string | null;
      client_nom?: string | null;
      client_email?: string | null;
      client_telephone?: string | null;
      date_visite?: string | null;
      note_globale?: number | null;
      categorie?: string | null;
      priorite?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('plaintes_clients')
        .insert({
          ...payload,
          source: 'manuel',
          statut: 'a_qualifier',
          est_formation: estFormation,
        })
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plaintes_clients'] });
      qc.invalidateQueries({ queryKey: ['sidebar-badges'] });
    },
  });
}

export function useQualifierPlainte() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      plainteId: string;
      statut: 'maintenance_confirmee' | 'hors_maintenance' | 'traite';
      qualifieParId: string;
      motif?: string | null;
      creerIncident?: boolean;
      incidentPayload?: {
        equipement_id: string;
        priorite_id: string;
        titre: string;
        description: string;
        parc_id: string;
      };
    }) => {
      const updateData: Record<string, unknown> = {
        statut: payload.statut,
        qualifie_par_id: payload.qualifieParId,
        qualifie_le: new Date().toISOString(),
        motif_qualification: payload.motif || null,
      };

      if (payload.creerIncident && payload.incidentPayload) {
        const { data: inc, error: incErr } = await supabase
          .from('incidents')
          .insert({
            equipement_id: payload.incidentPayload.equipement_id,
            priorite_id: payload.incidentPayload.priorite_id,
            titre: payload.incidentPayload.titre,
            description: payload.incidentPayload.description,
            source: 'plainte_client',
            statut: 'ouvert',
            declare_par_id: payload.qualifieParId,
          })
          .select('id')
          .single();
        if (incErr) throw incErr;
        updateData.incident_cree_id = inc.id;
      }

      const { error } = await supabase
        .from('plaintes_clients')
        .update(updateData)
        .eq('id', payload.plainteId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plaintes_clients'] });
      qc.invalidateQueries({ queryKey: ['sidebar-badges'] });
      qc.invalidateQueries({ queryKey: ['incidents'] });
    },
  });
}

export function useReclasserPlainte() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { plainteId: string; qualifieParId: string }) => {
      const { error } = await supabase
        .from('plaintes_clients')
        .update({
          statut: 'a_qualifier',
          qualifie_par_id: payload.qualifieParId,
          qualifie_le: new Date().toISOString(),
          motif_qualification: null,
        })
        .eq('id', payload.plainteId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plaintes_clients'] });
      qc.invalidateQueries({ queryKey: ['sidebar-badges'] });
    },
  });
}

export function useSyncRoller() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const apiUrl = `${supabaseUrl}/functions/v1/sync-roller-gxs`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erreur inconnue' }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['plaintes_clients'] });
      qc.invalidateQueries({ queryKey: ['sidebar-badges'] });
    },
  });
}
