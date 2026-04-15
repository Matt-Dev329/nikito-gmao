# Nikito GMAO · Front React v0.4

GMAO Lean Ballé pour les 4 parcs Nikito Group.

## ⚡ Démarrage rapide

**Pour Bolt.new (recommandé)** : ouvre `PROMPT_BOLT.md`, copie tout, colle comme premier message dans Bolt après import GitHub.

**Local** :
```bash
npm install
cp .env.example .env.local   # éditer avec tes clés Supabase
npm run dev
```

## 🎯 Vue d'ensemble

- **Stack** : React 18 + Vite + TS strict + Tailwind + Supabase + TanStack Query + PWA
- **Backend** : déployé sur projet Supabase `xhpykmhbahiikqbzwfkc` (27 tables, 5 triggers Lean, 8 vues KPI, 2 RPC)
- **Profils** : Direction · Chef d'équipe · Manager parc · Technicien · Staff opérationnel
- **2 modes d'auth** : email/password (4 profils) + PIN 6 chiffres (staff)
- **Inscription par invitation uniquement** (pas de signup public)

## 🆕 Nouveautés v0.4

- ✅ **Système d'invitation** complet (admin invite, invité crée son code/mdp)
- ✅ **Login staff repensé** : choix parc puis PIN 6 chiffres (pas de présélection avatar)
- ✅ **Notes de chantier** par parc (catégories, participants, décisions, pièces jointes)
- ✅ **Page UtilisateursAdmin** avec 4 onglets et système de validation
- ✅ **Page FicheParc** avec onglets dont notes chantier
- ✅ **ModaleNouveauFournisseur** réutilisable depuis n'importe où

## 📂 Structure

```
src/
├── App.tsx
├── components/
│   ├── layout/                    # Sidebar, DashboardLayout, TabletLayout
│   ├── controles/ControleEcran    # ⭐ Composant générique q/h/m
│   ├── forms/ModaleSignaler       # Bottom-sheet signalement
│   ├── admin/ModaleInviterUtilisateur  # ✨ nouveau
│   ├── ui/                        # Logo, Card, Pill, CritTag
│   ├── kpi/KpiCard
│   └── tickets/TicketCard
├── pages/
│   ├── auth/                      # Login + AcceptationInvitation ✨
│   ├── direction/                 # TableauDeBord
│   ├── ryad/                      # Recurrences
│   ├── technicien/                # Operations, Intervention, ControleHebdo
│   ├── staff/                     # LoginStaff (parc+PIN), ControleOuverture
│   ├── admin/                     # ListeParcs, CreationParcWizard, UtilisateursAdmin, PageFournisseursAdmin
│   ├── parc/                      # FicheParc, NotesChantierParc ✨
│   └── _stubs.tsx                 # 14 pages à compléter
├── hooks/
│   ├── useAuth                    # session + user métier
│   ├── queries/                   # useReferentiel, useKpi, useTickets
│   └── mutations/                 # à créer
├── lib/                           # supabase, tokens, utils
├── types/database.ts              # types métier
└── styles/index.css               # Tailwind + utilitaires
```

## 🚧 Reste à faire (pour Bolt)

Détails complets dans `PROMPT_BOLT.md`. En résumé :

1. Brancher TableauDeBord et autres pages mockées sur Supabase
2. Compléter wizard parc (étapes 2/4/5/6)
3. Compléter UtilisateursAdmin (charger les listes)
4. Compléter les 14 pages stubs
5. Créer hooks de mutation Supabase
6. Configurer 5 buckets Storage + compression photos

## ⚠️ Règles d'or non négociables

- ✅ Vocabulaire 100% **français** (cf `lib/tokens.ts > kpiLabels`)
- ✅ Couleurs **uniquement** depuis `tailwind.config.js` (jamais de hex en dur)
- ✅ Réutiliser `ControleEcran` pour tout écran de saisie de points
- ✅ Le projet est **dark mode only**
- ✅ Pas de signup public — uniquement par invitation

## 🔐 Authentification

| Profil | Mode | Login | Session |
|---|---|---|---|
| Direction · Chef · Manager · Tech | Email + mdp | `/login` | Supabase Auth |
| Staff opérationnel | PIN 6 chiffres | `/staff` (parc puis code) | sessionStorage |

**Inscription** : exclusivement via invitation. Admin clique "+ Inviter", génère un lien `/invitation/{token}`, l'invité choisit son code/mdp, compte créé avec statut `valide` directement.

**Permissions invitation** :
- Direction : invite tous les profils
- Chef équipe (Ryad) : invite tous les profils
- Manager parc : invite uniquement staff opérationnel pour son parc
