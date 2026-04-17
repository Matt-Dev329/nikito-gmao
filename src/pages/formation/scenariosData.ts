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
  {
    id: 'staff-04',
    titre: 'Signaler un incident terrain',
    description:
      "Un client vous signale qu'un jeu arcade ne fonctionne plus. Utilisez le formulaire de signalement pour creer un ticket rapidement depuis le terrain.",
    objectif: "Apprendre a signaler un incident sans passer par un controle.",
    difficulte: 1,
    lien: '/tech/signaler',
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
  {
    id: 'tech-04',
    titre: 'Le controle mensuel approfondi',
    description:
      "Realisez un controle mensuel complet avec votre binome. Verifiez chaque point technique, signez le rapport a deux, et validez.",
    objectif: "Maitriser le controle mensuel avec double signature.",
    difficulte: 2,
    lien: '/tech/controle-mensuel',
    groupe: 'technicien',
  },
  {
    id: 'tech-05',
    titre: 'Gerer le stock de pieces',
    description:
      "Apres une intervention, il vous reste une seule courroie en stock. Consultez le Stock, identifiez les pieces sous le seuil minimum, et verifiez les delais de reapprovisionnement.",
    objectif: "Savoir consulter le stock et identifier les pieces critiques.",
    difficulte: 1,
    lien: '/gmao/stock',
    groupe: 'technicien',
  },
  {
    id: 'tech-06',
    titre: 'Creer un equipement',
    description:
      "Un nouveau trampoline vient d'etre installe. Ajoutez-le dans la fiche Equipements avec son code, sa date de mise en service, sa zone et sa categorie.",
    objectif: "Savoir ajouter un equipement dans le referentiel.",
    difficulte: 2,
    lien: '/gmao/equipements',
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
  {
    id: 'dir-03',
    titre: 'Le tableau de bord du lundi matin',
    description:
      "C'est lundi, vous arrivez au bureau. Ouvrez le Tableau de bord, analysez la performance des 4 parcs sur 30 jours, identifiez le parc avec le plus d'incidents et les tickets bloquants en cours.",
    objectif: "Lire et interpreter les KPIs du tableau de bord.",
    difficulte: 1,
    lien: '/gmao',
    groupe: 'direction',
  },
  {
    id: 'dir-04',
    titre: 'Planifier une maintenance preventive',
    description:
      "Le fournisseur des trampolines recommande un remplacement des ressorts tous les 90 jours. Creez une maintenance preventive recurrente pour le trampoline principal.",
    objectif: "Maitriser la planification du preventif.",
    difficulte: 2,
    lien: '/gmao/preventif',
    groupe: 'direction',
  },
  {
    id: 'dir-05',
    titre: 'Gerer une plainte client',
    description:
      "Un client a laisse un avis Google negatif : 'Le laser game ne fonctionnait pas, decevant'. Consultez les Plaintes clients, associez la plainte a l'equipement concerne et verifiez si un ticket existe deja.",
    objectif: "Comprendre le suivi des plaintes et le lien avec les incidents.",
    difficulte: 2,
    lien: '/gmao/plaintes',
    groupe: 'direction',
  },
  {
    id: 'dir-06',
    titre: 'Verifier les certifications',
    description:
      "L'audit annuel approche. Ouvrez les Certifications, identifiez les equipements dont la certification expire dans les 30 prochains jours, et notez les normes concernees.",
    objectif: "Suivre les echeances de certification reglementaire.",
    difficulte: 2,
    lien: '/gmao/certifications',
    groupe: 'direction',
  },
  {
    id: 'dir-07',
    titre: "L'IA a votre service",
    description:
      "Ouvrez l'IA Predictive et lancez une analyse. Consultez le score de sante global, identifiez les equipements a risque, et creez une maintenance preventive directement depuis une recommandation de l'IA.",
    objectif: "Utiliser l'IA predictive pour anticiper les pannes.",
    difficulte: 3,
    lien: '/gmao/ia-predictive',
    groupe: 'direction',
  },
  {
    id: 'dir-08',
    titre: 'Gerer les fournisseurs',
    description:
      "Un nouveau fournisseur de pieces de laser game vient d'etre contractualise. Consultez la liste des Fournisseurs, verifiez les contrats existants et les SLA negocies.",
    objectif: "Naviguer dans le referentiel fournisseurs.",
    difficulte: 1,
    lien: '/gmao/fournisseurs',
    groupe: 'direction',
  },
  {
    id: 'dir-09',
    titre: 'Personnaliser les points de controle',
    description:
      "Le constructeur du bowling a ajoute un nouveau point de verification obligatoire. Ouvrez la Bibliotheque points, creez le nouveau point avec les bons parametres (type, categorie, bloquant).",
    objectif: "Savoir ajouter et configurer des points de controle.",
    difficulte: 3,
    lien: '/gmao/bibliotheque',
    groupe: 'direction',
  },
];

export const allScenarios = [...scenariosStaff, ...scenariosTechnicien, ...scenariosDirection];
