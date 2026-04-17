export interface TourStep {
  selector: string;
  titre: string;
  description: string;
  position: 'right' | 'bottom' | 'left' | 'top';
}

export const tourSteps: TourStep[] = [
  {
    selector: '[data-tour="tableau-de-bord"]',
    titre: 'Tableau de bord',
    description:
      'Vue globale de vos KPI : taux de conformite, temps moyen d\'intervention, tickets ouverts et recurrences actives. Tout se pilote depuis ici.',
    position: 'right',
  },
  {
    selector: '[data-tour="mon-parc"]',
    titre: 'Mon parc',
    description:
      'Acces direct a la fiche de votre parc : attractions, notes de chantier, personnalisation des points de controle et vue manager.',
    position: 'right',
  },
  {
    selector: '[data-tour="operations"]',
    titre: 'Operations',
    description:
      'Liste de tous les tickets (BT) en cours. Creez, assignez et suivez chaque intervention en temps reel.',
    position: 'right',
  },
  {
    selector: '[data-tour="equipements"]',
    titre: 'Equipements',
    description:
      'Registre complet de vos attractions et equipements avec fiches techniques, historique de maintenance et documents associes.',
    position: 'right',
  },
  {
    selector: '[data-tour="recurrences"]',
    titre: 'Recurrences',
    description:
      'La boucle Lean : identifiez les pannes qui se repetent et declenchez une analyse 5 Pourquoi pour eliminer les causes racines.',
    position: 'right',
  },
  {
    selector: '[data-tour="cinq-pourquoi"]',
    titre: '5 Pourquoi',
    description:
      'Methode de resolution de problemes : remontez la chaine des causes pour chaque panne recurrente et documentez les actions correctives.',
    position: 'right',
  },
  {
    selector: '[data-tour="stock"]',
    titre: 'Stock',
    description:
      'Suivi des pieces detachees et consommables. Anticipez les ruptures et planifiez vos approvisionnements.',
    position: 'right',
  },
  {
    selector: '[data-tour="preventif"]',
    titre: 'Preventif',
    description:
      'Planification de la maintenance preventive : calendrier des interventions programmees pour eviter les pannes.',
    position: 'right',
  },
  {
    selector: '[data-tour="certifications"]',
    titre: 'Certifications',
    description:
      'Suivi des certifications et habilitations reglementaires de vos equipements et de votre personnel.',
    position: 'right',
  },
  {
    selector: '[data-tour="plaintes"]',
    titre: 'Plaintes clients',
    description:
      'Centralisez et traitez les remontees clients liees a la securite ou au fonctionnement des attractions.',
    position: 'right',
  },
  {
    selector: '[data-tour="controles"]',
    titre: 'Historique controles',
    description:
      'Historique complet des controles d\'ouverture, hebdomadaires et mensuels. Exportez les registres au format PDF ou CSV.',
    position: 'right',
  },
  {
    selector: '[data-tour="controle-ouverture"]',
    titre: 'Controle d\'ouverture',
    description:
      'Check-list quotidienne avant l\'ouverture au public. Validez chaque point de securite attraction par attraction.',
    position: 'right',
  },
  {
    selector: '[data-tour="controle-hebdo"]',
    titre: 'Controle hebdomadaire',
    description:
      'Inspection technique approfondie realisee chaque semaine par les techniciens sur l\'ensemble du parc.',
    position: 'right',
  },
  {
    selector: '[data-tour="controle-mensuel"]',
    titre: 'Controle mensuel',
    description:
      'Verification mensuelle complete incluant les essais fonctionnels et les mesures reglementaires.',
    position: 'right',
  },
  {
    selector: '[data-tour="parcs"]',
    titre: 'Parcs',
    description:
      'Creez et configurez vos parcs : ajoutez des attractions, definissez les zones et parametrez la structure.',
    position: 'right',
  },
  {
    selector: '[data-tour="utilisateurs"]',
    titre: 'Utilisateurs',
    description:
      'Gerez votre equipe : invitez de nouveaux membres, attribuez les roles (direction, chef d\'equipe, technicien, manager, staff).',
    position: 'right',
  },
  {
    selector: '[data-tour="bibliotheque"]',
    titre: 'Bibliotheque points',
    description:
      'Referentiel central de tous les points de controle. Creez, modifiez et organisez les items utilises dans vos check-lists.',
    position: 'right',
  },
  {
    selector: '[data-tour="fournisseurs"]',
    titre: 'Fournisseurs',
    description:
      'Annuaire de vos fournisseurs de pieces et prestataires de maintenance. Contacts et references centralises.',
    position: 'right',
  },
  {
    selector: '[data-tour="aide"]',
    titre: 'Aide',
    description:
      'Guide d\'utilisation adapte a votre role, formulaire de contact support, et possibilite de relancer cette visite a tout moment.',
    position: 'right',
  },
];
