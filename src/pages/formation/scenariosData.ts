export interface Scenario {
  id: string;
  titre: string;
  description: string;
  objectif: string;
  difficulte: 1 | 2 | 3;
  lien: string;
  groupe: 'staff' | 'technicien' | 'direction';
}

export const scenariosStaff: Scenario[] = [
  {
    id: 'staff-01',
    titre: 'Le matin parfait',
    description:
      "Realisez un controle d'ouverture complet. Tout est conforme — cochez chaque point OK et signez.",
    objectif: "Apprendre le flow de base du controle quotidien.",
    difficulte: 1,
    lien: '/staff/controle-ouverture',
    groupe: 'staff',
  },
  {
    id: 'staff-02',
    titre: 'La mousse dechiree',
    description:
      "Lors du controle, vous decouvrez qu'un pad de protection est dechire. Marquez-le KO, prenez une photo, ajoutez un commentaire. Observez le ticket se creer automatiquement dans Operations.",
    objectif: "Apprendre a gerer un KO avec photo et commentaire.",
    difficulte: 2,
    lien: '/staff/controle-ouverture',
    groupe: 'staff',
  },
  {
    id: 'staff-03',
    titre: "L'urgence securite",
    description:
      "Une sortie de secours est bloquee ! C'est un point BLOQUANT. Marquez-le KO, observez l'alerte rouge dans Operations.",
    objectif: "Comprendre la difference entre un KO normal et un KO bloquant.",
    difficulte: 2,
    lien: '/staff/controle-ouverture',
    groupe: 'staff',
  },
];

export const scenariosTechnicien: Scenario[] = [
  {
    id: 'tech-01',
    titre: 'Votre premiere intervention',
    description:
      "Un ticket vous attend dans Operations : un pad de trampoline dechire. Demarrez l'intervention, decrivez la reparation, prenez une photo, et cloturez.",
    objectif: "Maitriser le cycle complet d'une intervention.",
    difficulte: 1,
    lien: '/gmao/operations',
    groupe: 'technicien',
  },
  {
    id: 'tech-02',
    titre: 'Le controle hebdomadaire',
    description:
      "Realisez un controle hebdomadaire complet de la zone Trampoline. Inspectez chaque point, notez les anomalies.",
    objectif: "Maitriser le controle hebdomadaire par activite.",
    difficulte: 2,
    lien: '/tech/controle-hebdo',
    groupe: 'technicien',
  },
  {
    id: 'tech-03',
    titre: 'La panne recurrente',
    description:
      "Le trampoline principal ECO-TRAMP-01 est tombe en panne 3 fois en 30 jours. Consultez les Recurrences et ouvrez un 5 Pourquoi.",
    objectif: "Comprendre le cycle recurrence -> 5 Pourquoi.",
    difficulte: 3,
    lien: '/gmao/recurrences',
    groupe: 'technicien',
  },
];

export const scenariosDirection: Scenario[] = [
  {
    id: 'dir-01',
    titre: 'Analyser une cause racine',
    description:
      "Une fiche 5 Pourquoi est ouverte pour le trampoline recurrent. Completez l'analyse : remplissez les Pourquoi 4 et 5, identifiez la cause racine, definissez une contre-mesure.",
    objectif: "Maitriser la methode 5 Pourquoi.",
    difficulte: 2,
    lien: '/gmao/cinq-pourquoi',
    groupe: 'direction',
  },
  {
    id: 'dir-02',
    titre: 'Exporter pour la DGCCRF',
    description:
      "Un controleur DGCCRF vous demande les registres du dernier mois. Allez dans Controles, filtrez la periode, exportez le CSV et envoyez-le par email.",
    objectif: "Maitriser l'export et l'envoi de rapports.",
    difficulte: 3,
    lien: '/gmao/controles-historique',
    groupe: 'direction',
  },
];

export const allScenarios = [...scenariosStaff, ...scenariosTechnicien, ...scenariosDirection];
