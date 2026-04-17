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
      'Registre complet de vos attractions et equipements avec fiches techniques, historique et documents.',
    position: 'right',
  },
  {
    selector: '[data-tour="controles"]',
    titre: 'Controles',
    description:
      'Historique des controles d\'ouverture, hebdomadaires et mensuels. Exportez les registres au format PDF ou CSV.',
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
    selector: '[data-tour="utilisateurs"]',
    titre: 'Utilisateurs',
    description:
      'Gerez votre equipe : invitez de nouveaux membres, attribuez les roles (direction, chef d\'equipe, technicien, manager, staff).',
    position: 'right',
  },
  {
    selector: '[data-tour="aide"]',
    titre: 'Aide',
    description:
      'Retrouvez le guide d\'utilisation adapte a votre role et contactez le support si besoin. Vous pouvez relancer cette visite a tout moment depuis cette page.',
    position: 'right',
  },
];
