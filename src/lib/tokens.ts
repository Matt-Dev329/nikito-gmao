// ============================================================
// Design tokens Nikito · source unique de vérité
// Pour toute autre couleur ou utilité, passer par tailwind.config.js
// ============================================================

export const colors = {
  bgApp: '#0B0B2E',
  bgCard: '#151547',
  bgSidebar: '#07071F',
  bgDeep: '#0D0D38',

  pink: '#E85A9B',
  violet: '#9B7EE8',
  cyan: '#5DE5FF',

  lime: '#D4F542',
  amber: '#FFB547',
  red: '#FF4D6D',
  green: '#4DD09E',

  text: '#FFFFFF',
  dim: '#A8A8C8',
  faint: '#6E6E96',
} as const;

export const criticite = {
  bloquant: { bg: colors.red, label: 'BLOQUANT' },
  majeur: { bg: colors.amber, label: 'MAJEUR' },
  mineur: { bg: colors.cyan, label: 'MINEUR' },
} as const;

// Mapping rôles → libellé français (consigne stricte vocabulaire FR)
export const roleLabels: Record<string, string> = {
  direction: 'Direction',
  chef_maintenance: "Chef d'équipe",
  manager_parc: 'Manager parc',
  technicien: 'Technicien',
  staff_operationnel: 'Staff opérationnel',
  admin_it: 'Admin IT',
};

// KPI labels français (consigne vocabulaire stricte du README)
export const kpiLabels = {
  performance: 'Performance globale',
  mtbf: 'Temps entre pannes',
  mttr: 'Temps de réparation',
  premierCoup: 'Réparé du 1er coup',
  plaintes: 'Plaintes équipement',
} as const;
