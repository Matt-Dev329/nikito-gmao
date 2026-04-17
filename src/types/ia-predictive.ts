export interface EquipementRisque {
  equipement_id: string;
  equipement_code: string;
  equipement_libelle: string;
  parc: string;
  score_risque: number;
  prediction: string;
  justification: string;
  action_recommandee: string;
  priorite: 'haute' | 'moyenne' | 'basse';
  date_panne_estimee: string;
}

export interface AlerteIA {
  type:
    | 'garantie_expiration'
    | 'controle_manquant'
    | 'stock_critique'
    | 'certification_expiration'
    | 'tendance_degradation';
  message: string;
  parc: string;
  priorite: 'haute' | 'moyenne' | 'basse';
}

export interface RecommandationIA {
  titre: string;
  description: string;
  impact_estime: string;
  cout_estime: string;
  deadline_suggeree: string;
}

export interface KpiPredictions {
  mtbf_prevu_30j: number;
  incidents_prevus_30j: number;
  taux_conformite_prevu: number;
  equipements_necessitant_attention: number;
}

export interface AnalyseIA {
  score_sante_global: number;
  tendance: 'stable' | 'amelioration' | 'degradation';
  equipements_a_risque: EquipementRisque[];
  alertes: AlerteIA[];
  recommandations: RecommandationIA[];
  kpi_predictions: KpiPredictions;
}

export interface AnalyseIACachee {
  timestamp: number;
  analyse: AnalyseIA;
}

export interface MaintenanceEquipementData {
  equipement_id: string;
  code: string;
  libelle: string;
  parc_code: string;
  parc_nom: string;
  statut: string;
  date_mise_service: string | null;
  date_fin_garantie: string | null;
  a_surveiller: boolean;
  incidents_total: number;
  incidents_30j: number;
  incidents_60j: number;
  incidents_90j: number;
  recurrences: number;
  pannes_30j: number;
}

export interface MaintenanceParcsData {
  parc_id: string;
  parc_code: string;
  parc_nom: string;
  performance_pct: number;
  incidents_ouverts: number;
  stock_critique: number;
}

export interface MaintenanceData {
  equipements: MaintenanceEquipementData[];
  parcs: MaintenanceParcsData[];
  date_analyse: string;
}
