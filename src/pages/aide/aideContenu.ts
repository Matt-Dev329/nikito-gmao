import type { RoleUtilisateur } from '@/types/database';

export interface SectionAide {
  emoji: string;
  titre: string;
  items: string[];
}

export interface GuideAide {
  titre: string;
  sections: SectionAide[];
}

const guideDirection: GuideAide = {
  titre: 'Guide Direction — Pilotage multi-parcs',
  sections: [
    {
      emoji: '\u{1F3E0}',
      titre: 'Tableau de bord',
      items: [
        'Le tableau de bord affiche les **KPI en temps réel** de tous vos parcs.',
        'Filtrez par parc en cliquant sur les pills (**ALF**, **DOM**, **FRA**, **SGB**).',
        'Changez la période : **7 jours**, **30 jours**, **90 jours**.',
        'KPI : **Performance Globale** (% disponibilité), **Temps entre pannes** (MTBF), **Temps de réparation** (MTTR), **Réparé du 1er coup** (FTF), **Plaintes**.',
      ],
    },
    {
      emoji: '\u{1F527}',
      titre: 'Opérations',
      items: [
        'Liste tous les tickets de maintenance (incidents, pannes, signalements).',
        'Onglets : **À faire** / **En cours** / **Contrôles** / **Préventif**.',
        'Filtrez par parc. Chaque ticket montre équipement, description, criticité.',
        'Badge **BLOQUANT** en rouge = urgent.',
        'Cliquez sur un ticket pour le détail et l\'historique.',
      ],
    },
    {
      emoji: '\u2705',
      titre: 'Contrôles — Registre DGCCRF',
      items: [
        'Page **Contrôles** : historique complet de tous les contrôles effectués.',
        'Sélecteur de dates (aujourd\'hui, 7j, 30j, mois, trimestre, année).',
        'Filtrez par parc et type (quotidien, hebdo, mensuel).',
        'Chaque contrôle : date, parc, type, contrôleur, statut, OK/KO.',
        'Bouton **Voir** : détail avec tous les points, photos, signature.',
        'Bouton **Exporter CSV** et **Envoyer par email**.',
        '⚠️ Un contrôle validé ne peut **JAMAIS** être modifié (conformité DGCCRF).',
      ],
    },
    {
      emoji: '\u{1F4CA}',
      titre: 'Récurrences & 5 Pourquoi',
      items: [
        '3+ pannes en 30 jours sur le même équipement → apparaît dans **Récurrences**.',
        'Depuis Récurrences → ouvrir un **5 Pourquoi** pour analyser la cause racine.',
        '5P : Pourquoi 1 → 2 → 3 → 4 → 5 → **Cause racine** → **Contre-mesure**.',
        'Clôture du 5P → **Audit 90j** programmé automatiquement.',
        'Si panne revient pendant les 90j → 5P se rouvre automatiquement.',
      ],
    },
    {
      emoji: '\u{1F465}',
      titre: 'Gestion des utilisateurs',
      items: [
        'Page **Utilisateurs** : comptes actifs, invitations en cours.',
        'Bouton **+ Inviter** : envoie un email d\'invitation automatique.',
        'L\'invité reçoit un lien, choisit son mot de passe, accède à l\'app.',
        '5 rôles : **Direction**, **Chef d\'équipe**, **Manager parc**, **Technicien**, **Staff**.',
      ],
    },
    {
      emoji: '\u2699\uFE0F',
      titre: 'Configuration',
      items: [
        '**Parcs** : fiches des 4 parcs, attractions, points de contrôle.',
        '**Équipements** : liste complète, import CSV, filtres.',
        '**Bibliothèque de points** : 367 points par catégorie.',
        '**Fournisseurs** : carnet d\'adresses prestataires.',
      ],
    },
  ],
};

const guideChefMaintenance: GuideAide = {
  titre: 'Guide Chef d\'équipe — Gestion de la maintenance',
  sections: [
    {
      emoji: '\u{1F4CB}',
      titre: 'Votre rôle',
      items: [
        'Superviser les techniciens et valider les contrôles.',
        'Accès complet comme la Direction.',
        'Assigner des tickets aux techniciens.',
        'Arbitrer les récurrences et ouvrir les **5 Pourquoi**.',
      ],
    },
    {
      emoji: '\u{1F527}',
      titre: 'Gérer les opérations',
      items: [
        'Les tickets arrivent automatiquement quand un contrôle détecte un **KO**.',
        'Assigner aux techniciens via **Réassigner**.',
        'Suivre l\'avancement dans **En cours**.',
        'Valider les interventions terminées.',
      ],
    },
    {
      emoji: '\u2705',
      titre: 'Superviser les contrôles',
      items: [
        'Consulter tous les contrôles de l\'équipe dans **Contrôles**.',
        'Vérifier que les quotidiens sont faits chaque jour.',
        'Un KO génère automatiquement un ticket dans **Opérations**.',
      ],
    },
    {
      emoji: '\u{1F504}',
      titre: 'Boucle d\'amélioration',
      items: [
        '**Récurrences** → **5 Pourquoi** → **Standard évolutif** → **Audit 90j**.',
        'Cycle Lean pour éliminer les pannes récurrentes.',
      ],
    },
  ],
};

const guideTechnicien: GuideAide = {
  titre: 'Guide Technicien — Interventions terrain',
  sections: [
    {
      emoji: '\u{1F4F1}',
      titre: 'Vue tablette',
      items: [
        'Vue optimisée pour **iPad/tablette** sur le terrain.',
        'Accès via **/tech** ou le menu.',
      ],
    },
    {
      emoji: '\u{1F527}',
      titre: 'Mes opérations',
      items: [
        'Tickets assignés dans **À faire**.',
        'Cliquer → **Démarrer intervention** → chrono démarre.',
        'Prendre photos avant/après.',
        'Décrire l\'intervention.',
        '**Terminer** quand c\'est réparé.',
      ],
    },
    {
      emoji: '\u2705',
      titre: 'Contrôle hebdomadaire',
      items: [
        'Chaque semaine, contrôle des attractions.',
        'Sélectionner les activités (Trampoline, Soft Play, Laser Game...).',
        'Pour chaque point : **OK** / **KO** / **N/A**.',
        '**KO** = photo obligatoire + commentaire.',
        'Ticket créé automatiquement pour chaque KO.',
        'Signer pour valider.',
      ],
    },
    {
      emoji: '\u2705',
      titre: 'Contrôle mensuel',
      items: [
        'Contrôle approfondi structure et sécurité.',
        'Points détaillés : boulonnerie, corrosion, châssis...',
        'Photo obligatoire si non conforme.',
      ],
    },
    {
      emoji: '\u{1F4E6}',
      titre: 'Stock',
      items: [
        'Pièces détachées disponibles.',
        'Noter les pièces utilisées lors des interventions.',
        'Signaler quand le stock est bas.',
      ],
    },
  ],
};

const guideManagerParc: GuideAide = {
  titre: 'Guide Manager — Votre parc au quotidien',
  sections: [
    {
      emoji: '\u{1F3E2}',
      titre: 'Mon parc',
      items: [
        'Résumé de votre parc : équipements, incidents, dernier contrôle.',
        'Vue rapide pour le **briefing du matin**.',
      ],
    },
    {
      emoji: '\u{1F527}',
      titre: 'Opérations de mon parc',
      items: [
        'Uniquement les tickets de **votre parc**.',
        'Suivre les interventions en cours.',
        'Signaler de nouveaux problèmes.',
      ],
    },
    {
      emoji: '\u2705',
      titre: 'Contrôles',
      items: [
        'Vérifier que les contrôles quotidiens sont faits par le staff.',
        'Consulter l\'historique de votre parc.',
      ],
    },
  ],
};

const guideStaff: GuideAide = {
  titre: 'Guide Staff — Contrôle d\'ouverture',
  sections: [
    {
      emoji: '\u{1F510}',
      titre: 'Connexion',
      items: [
        'Code **PIN à 4 chiffres**.',
        'Pas besoin d\'email ni de mot de passe.',
      ],
    },
    {
      emoji: '\u2705',
      titre: 'Contrôle d\'ouverture (tous les jours)',
      items: [
        'Mission principale chaque matin **AVANT l\'ouverture au public** :',
        '1. Ouvrir l\'app → votre parc s\'affiche automatiquement.',
        '2. Parcourir la checklist point par point.',
        '3. Pour chaque point : **OK** ou **KO**.',
        '4. Si **KO** : photo + commentaire.',
        '5. Signer avec le doigt sur l\'écran.',
        '6. Cliquer **Valider le contrôle**.',
        '7. Une fois validé = **verrouillé définitivement**.',
        'Les KO créent automatiquement un ticket pour le technicien.',
      ],
    },
    {
      emoji: '\u{1F6A8}',
      titre: 'Signaler un problème',
      items: [
        'En dehors du contrôle, signaler un problème à tout moment.',
        'Description + photo + zone.',
        'Ticket créé pour l\'équipe maintenance.',
      ],
    },
    {
      emoji: '\u2753',
      titre: 'FAQ',
      items: [
        '**« Je me suis trompé »** → Impossible de modifier après validation. Prévenez votre manager.',
        '**« L\'app ne charge pas »** → Vérifiez le WiFi. Rafraîchissez la page.',
        '**« J\'ai oublié mon PIN »** → Demandez à votre manager.',
      ],
    },
  ],
};

export const guidesParRole: Record<RoleUtilisateur, GuideAide> = {
  direction: guideDirection,
  chef_maintenance: guideChefMaintenance,
  technicien: guideTechnicien,
  manager_parc: guideManagerParc,
  staff_operationnel: guideStaff,
};
