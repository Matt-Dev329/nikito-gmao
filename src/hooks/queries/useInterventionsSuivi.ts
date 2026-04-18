import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useFormationFilter } from '@/hooks/useFormation';

export interface InterventionSuivi {
  id: string;
  numero_bt: string;
  titre: string;
  description: string | null;
  statut: string;
  source: string | null;
  declare_le: string;
  resolu_le: string | null;
  photos_urls: string[] | null;
  equipement_code: string;
  equipement_libelle: string;
  parc_id: string;
  parc_code: string;
  parc_nom: string;
  zone_nom: string | null;
  priorite_code: string;
  priorite_nom: string;
  priorite_couleur: string;
  technicien_id: string | null;
  technicien_prenom: string | null;
  technicien_nom: string | null;
  intervention_debut: string | null;
  intervention_fin: string | null;
  photos_avant: string[] | null;
  photos_apres: string[] | null;
}

export interface InterventionKpis {
  enCours: number;
  termineesAujourdhui: number;
  mttrMinutes: number;
  enAttente: number;
}

function sourceLabel(s: string | null): string {
  const map: Record<string, string> = {
    controle_ouverture: 'Controle quotidien',
    controle_hebdo: 'Controle hebdo',
    controle_mensuel: 'Controle mensuel',
    staff_caisse: 'Signalement caisse',
    plainte_client: 'Plainte client',
    previsionnel_auto: 'IA predictive',
    tech_terrain: 'Signalement terrain',
    capteur: 'Capteur',
  };
  return s ? (map[s] ?? s) : 'Non precise';
}

export { sourceLabel };

export function useInterventionsSuivi(parcId: string | null) {
  const { estFormation } = useFormationFilter();

  return useQuery({
    queryKey: ['interventions-suivi', parcId, estFormation],
    queryFn: async (): Promise<InterventionSuivi[]> => {
      if (!parcId) return [];

      const { data, error } = await supabase
        .from('incidents')
        .select(`
          id, numero_bt, titre, description, statut, source,
          declare_le, resolu_le, photos_urls,
          equipements!inner(code, libelle, parc_id, parcs(code, nom), zones(nom)),
          niveaux_priorite(code, nom, couleur_hex)
        `)
        .eq('equipements.parc_id', parcId)
        .eq('est_formation', estFormation)
        .in('statut', ['ouvert', 'assigne', 'en_cours', 'resolu', 'ferme'])
        .order('declare_le', { ascending: false })
        .limit(200);

      if (error) throw error;
      if (!data) return [];

      const incidentIds = data.map((d: any) => d.id);
      let interventionsMap: Record<string, any> = {};

      if (incidentIds.length > 0) {
        const { data: intData } = await supabase
          .from('interventions')
          .select(`
            incident_id, debut, fin, photos_avant, photos_apres,
            technicien_id,
            utilisateurs!technicien_id(id, prenom, nom)
          `)
          .in('incident_id', incidentIds)
          .order('debut', { ascending: false });

        if (intData) {
          for (const row of intData as any[]) {
            if (!interventionsMap[row.incident_id]) {
              interventionsMap[row.incident_id] = row;
            }
          }
        }
      }

      return data.map((d: any) => {
        const eq = d.equipements;
        const prio = d.niveaux_priorite;
        const inter = interventionsMap[d.id];
        const tech = inter?.utilisateurs;
        return {
          id: d.id,
          numero_bt: d.numero_bt,
          titre: d.titre,
          description: d.description,
          statut: d.statut,
          source: d.source,
          declare_le: d.declare_le,
          resolu_le: d.resolu_le,
          photos_urls: d.photos_urls,
          equipement_code: eq?.code ?? '',
          equipement_libelle: eq?.libelle ?? '',
          parc_id: eq?.parc_id ?? parcId,
          parc_code: eq?.parcs?.code ?? '',
          parc_nom: eq?.parcs?.nom ?? '',
          zone_nom: eq?.zones?.nom ?? null,
          priorite_code: prio?.code ?? 'p3',
          priorite_nom: prio?.nom ?? '',
          priorite_couleur: prio?.couleur_hex ?? '#5DE5FF',
          technicien_id: tech?.id ?? null,
          technicien_prenom: tech?.prenom ?? null,
          technicien_nom: tech?.nom ?? null,
          intervention_debut: inter?.debut ?? null,
          intervention_fin: inter?.fin ?? null,
          photos_avant: inter?.photos_avant ?? null,
          photos_apres: inter?.photos_apres ?? null,
        } satisfies InterventionSuivi;
      });
    },
    enabled: !!parcId,
    refetchInterval: 30_000,
  });
}

export function useInterventionKpis(interventions: InterventionSuivi[] | undefined): InterventionKpis {
  if (!interventions) return { enCours: 0, termineesAujourdhui: 0, mttrMinutes: 0, enAttente: 0 };

  const todayStr = new Date().toISOString().slice(0, 10);
  let enCours = 0;
  let terminees = 0;
  let totalDureeMin = 0;
  let enAttente = 0;

  for (const i of interventions) {
    if (i.statut === 'en_cours') enCours++;
    if (i.statut === 'ouvert' || i.statut === 'assigne') enAttente++;
    if ((i.statut === 'resolu' || i.statut === 'ferme') && i.resolu_le?.slice(0, 10) === todayStr) {
      terminees++;
      if (i.declare_le && i.resolu_le) {
        const duree = (new Date(i.resolu_le).getTime() - new Date(i.declare_le).getTime()) / 60_000;
        totalDureeMin += duree;
      }
    }
  }

  return {
    enCours,
    termineesAujourdhui: terminees,
    mttrMinutes: terminees > 0 ? Math.round(totalDureeMin / terminees) : 0,
    enAttente,
  };
}

export function useNotificationsInterventions(parcId: string | null) {
  return useQuery({
    queryKey: ['notifs-interventions', parcId],
    queryFn: async () => {
      if (!parcId) return [];
      const { data, error } = await supabase
        .from('notifications_interventions')
        .select('*')
        .eq('parc_id', parcId)
        .order('cree_le', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!parcId,
    refetchInterval: 30_000,
  });
}
