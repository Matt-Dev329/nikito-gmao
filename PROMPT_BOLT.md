# 🚀 PROMPT BOLT · Nikito GMAO V1

> **Comment l'utiliser** : copier intégralement ce contenu et le coller comme **premier message** dans Bolt après import du repo `nikito-gmao` depuis GitHub.

---

# Mission

Je suis directeur de **Nikito Group**, un groupe de 4 parcs de loisirs indoor en Île-de-France (Franconville, Sainte-Geneviève-des-Bois, Rosny Domus, Alfortville). Je veux finaliser la **GMAO Lean Ballé** que j'ai commencée. Le projet est **bien avancé** : backend Supabase déployé, squelette React en place, écrans principaux maquettés et hooks préparés.

**Ton rôle** : compléter les pages stub, brancher les vrais appels Supabase à la place des mocks, m'aider à itérer visuellement. **Ne refais pas ce qui existe**, étends.

---

# Backend Supabase déployé sur projet `xhpykmhbahiikqbzwfkc`

## 27 tables · RLS activé sur les sensibles
Référentiel : `parcs`, `zones`, `categories_equipement`, `fournisseurs`, `parc_attractions`
Équipements : `equipements`, `pieces_detachees`, `fixtures_lumiere`
Tickets : `niveaux_priorite`, `incidents`, `interventions`, `pieces_utilisees`
Préventif : `maintenances_preventives`, `certifications`
Contrôles : `bibliotheque_points`, `controles`, `controle_items`
Humain : `roles`, `utilisateurs`, `parcs_utilisateurs`
Lean : `fiches_5_pourquoi`, `standards_evolutifs`, `plaintes_clients`, `archives_pdf`
RGPD : `gps_positions`
**Nouveau** : `invitations`, `notes_chantier`

## 5 triggers métier Lean
`auto_create_incident`, `check_recurrence`, `decrement_stock`, `update_certification`, `check_plaintes_recurrence`

## 8 vues KPI
`vue_kpi_performance`, `vue_kpi_mtbf`, `vue_kpi_mttr`, `vue_kpi_premier_coup`, `vue_kpi_plaintes`, `vue_recurrences_actives`, `vue_avancement_hebdo`, `vue_perf_technicien_30j`

## 2 fonctions RPC
- `verifier_pin_staff(p_parc_code, p_pin)` → vérifie un code staff sur un parc
- `accepter_invitation(p_token, p_auth_user_id, p_pin_clair)` → finalise une inscription

## Données seed prêtes
4 parcs (FRA, SGB, DOM, ALF), 26 catégories, 38 mappings parc-attractions, 3 niveaux de priorité, 5 rôles, 15 fournisseurs.

---

# Architecture authentification (changement majeur v0.4)

## 2 modes d'auth distincts

| Profil | Mode | Page de login | Stockage session |
|---|---|---|---|
| Direction · Chef équipe · Manager · Technicien | **Email + mot de passe** | `/login` (Supabase Auth) | `auth.users` |
| Staff opérationnel | **Code PIN 6 chiffres** | `/staff` (RPC custom) | `sessionStorage` |

## Flux d'inscription : invitation uniquement (pas de signup public)

1. Admin (Direction, Chef équipe, ou Manager parc pour son staff) clique "+ Inviter"
2. Modale `ModaleInviterUtilisateur` : choix du mode (email/PIN), prénom/nom, rôle pré-attribué, parcs assignés
3. INSERT dans `invitations` avec un `token` aléatoire et `expire_le = NOW() + 7d`
4. Lien d'invitation : `https://app.nikito.com/invitation/{token}`
5. L'invité clique → page `AcceptationInvitation` → choisit son mot de passe OU son code PIN
6. Appel RPC `accepter_invitation` → crée l'utilisateur avec `statut_validation = 'valide'` directement
7. Redirection vers `/login` (email) ou `/staff` (PIN)

## Login staff en 2 étapes

1. Choisir son parc (FRA / SGB / DOM / ALF) — il peut être assigné à plusieurs
2. Taper son code 6 chiffres → RPC `verifier_pin_staff(parc_code, pin)`
3. Session stockée dans `sessionStorage`, expiration auto à la fermeture du navigateur

**Pourquoi pas Supabase Auth pour staff ?** Pas d'email donc impossible. La RPC custom suffit pour identifier la personne via son PIN, et la table `utilisateurs` garde la traçabilité.

---

# Design system (DA Nikito · ne PAS modifier)

## Couleurs (Tailwind classes obligatoires)

**Fonds** : `bg-app` (#0B0B2E) · `bg-card` (#151547) · `bg-sidebar` (#07071F) · `bg-deep` (#0D0D38)
**Marque** : `nikito-pink` (#E85A9B) · `nikito-violet` (#9B7EE8) · `nikito-cyan` (#5DE5FF)
**KPI** : `lime` (OK) · `amber` (attention) · `red` (bloquant) · `green` (succès)
**Texte** : `text` (#FFF) · `dim` (#A8A8C8) · `faint` (#6E6E96)
**Gradients** : `bg-gradient-logo` · `bg-gradient-cta` · `bg-gradient-action` · `bg-gradient-danger`

## Interdictions absolues
- ❌ Pas de hex en dur dans le JSX (toujours via classes Tailwind)
- ❌ Pas de mode clair (le projet est dark mode only)
- ❌ Pas de `text-gray-*` ni `bg-gray-*` (utilise `dim`, `faint`, `bg-card`)
- ❌ Pas de couleur introduite hors palette

## Vocabulaire 100% français (CRITIQUE)
Centralisé dans `src/lib/tokens.ts > kpiLabels`. Aucun anglicisme dans l'UI :
- "Performance globale" pas "OEE"
- "Temps entre pannes" pas "MTBF"
- "Réparé du 1er coup" pas "FTFR"
- "Bon de travail" pas "Work order"
- "Fiche 5 Pourquoi" pas "Root cause analysis"

---

# Pages déjà codées (ne PAS refaire)

| Page | Profil | Fichier | Statut |
|---|---|---|---|
| Login email/password | Tous sauf staff | `pages/auth/Login.tsx` | ✅ Branché Supabase Auth |
| Acceptation invitation | Tous (au signup) | `pages/auth/AcceptationInvitation.tsx` | ✅ Branché RPC |
| TableauDeBord | Direction | `pages/direction/TableauDeBord.tsx` | 🟡 Mock à brancher |
| Recurrences | Ryad | `pages/ryad/Recurrences.tsx` | 🟡 Mock à brancher |
| Operations | Technicien | `pages/technicien/Operations.tsx` | 🟡 Mock à brancher |
| Intervention | Technicien | `pages/technicien/Intervention.tsx` | 🟡 Mock à brancher |
| ControleHebdo | Technicien | `pages/technicien/ControleHebdo.tsx` | 🟡 Mock à brancher |
| LoginStaff (parc puis PIN) | Staff | `pages/staff/LoginStaff.tsx` | ✅ Branché RPC |
| ControleOuverture | Staff | `pages/staff/ControleOuverture.tsx` | 🟡 Mock à brancher |
| ListeParcs | Admin | `pages/admin/ListeParcs.tsx` | ✅ Branché Supabase |
| CreationParcWizard | Admin | `pages/admin/CreationParcWizard.tsx` | 🟡 Étape 1+3 OK, 2/4/5/6 à compléter |
| FicheParc (onglets) | Admin | `pages/parc/FicheParc.tsx` | 🟡 Squelette + onglets |
| NotesChantierParc ⭐ | Admin/Manager | `pages/parc/NotesChantierParc.tsx` | ✅ Branché Supabase |
| UtilisateursAdmin (4 onglets) | Direction/Chef/Manager | `pages/admin/UtilisateursAdmin.tsx` | 🟡 Liste à charger |
| PageFournisseursAdmin | Admin | `pages/admin/PageFournisseursAdmin.tsx` | ✅ Branché Supabase |
| ModaleInviterUtilisateur | Admin (composant) | `components/admin/ModaleInviterUtilisateur.tsx` | ✅ Crée invitation |
| ModaleNouveauFournisseur | Admin (composant) | `pages/admin/PageFournisseursAdmin.tsx` | ✅ Crée fournisseur (export aussi pour usage externe) |
| ControleEcran ⭐ | Composant générique | `components/controles/ControleEcran.tsx` | ✅ Réutilisé quotidien/hebdo/mensuel |
| ModaleSignaler | Composant | `components/forms/ModaleSignaler.tsx` | ✅ UI prête, mutation à faire |

---

# Hooks préparés (à utiliser, pas à recréer)

```ts
// Auth
useAuth() // → { session, authUser, utilisateur, loading, signIn, signOut }

// Référentiel
useParcs(), useParc(id), useCategoriesEquipement(),
useFournisseurs(), useEquipements(parcId?)

// KPI (vues SQL)
useKpiPerformance(), useKpiMtbf(), useKpiMttr(),
useKpiPremierCoup(), useKpiPlaintes(),
useRecurrencesActives(), useAvancementHebdo(parcId?), usePerfTechnicien30j()

// Tickets
useIncidents(filtres), useIncident(numeroBT),
useStock(), useStockBas(), useFiches5Pourquoi(statut?)
```

À CRÉER côté `src/hooks/mutations/` :
- `useCreerIncident()` (signaler)
- `useDemarrerIntervention()` / `useTerminerIntervention()`
- `useAjouterPiece()` (déclenche trigger SQL `decrement_stock`)
- `useSaisirPointControle()` (sur `controle_items`, déclenche `auto_create_incident` si HS)
- `useValiderControle()` (UPDATE controles + génération PDF SHA256)
- `useCreerParc()`, `useCreerZone()`, `useCreerEquipement()`
- `useCreerInvitation()`, `useCreerFournisseur()`, `useCreerNoteChantier()`

---

# Ce qu'il reste à faire (ton boulot, par ordre de priorité)

## 🎯 Priorité 1 — Brancher TableauDeBord sur les vraies vues KPI
Le mock actuel doit être remplacé. Importe les hooks `useKpi*`, affiche un skeleton pendant chargement, gère les erreurs proprement.

## 🎯 Priorité 2 — Compléter le wizard `CreationParcWizard`

**Étape 2 · Plan & zones** : éditeur SVG interactif
- Import SVG/PNG en background
- Mode dessin : clic-glisser pour créer un rectangle
- Poignées de redimensionnement aux 4 coins
- Édition du nom de zone inline
- Sauvegarde des `coordonnees_plan` (JSONB `{x, y, w, h}`) dans `zones`

**Étape 4 · Équipements** :
- Liste des équipements à créer
- Ajout unitaire (modal) ou import CSV (parser format `code,libelle,categorie,zone,numero_serie`)
- Génération auto du code (ex `DOM-KAR-P07`)
- Bouton "+ Nouveau fournisseur" qui ouvre `ModaleNouveauFournisseur` si fournisseur manquant ✨

**Étape 5 · Équipe** :
- Choix : "Inviter de nouveaux utilisateurs" (ouvre `ModaleInviterUtilisateur`) OU "Sélectionner des utilisateurs existants"
- Liste des utilisateurs disponibles avec checkbox
- Désignation manager principal (radio)

**Étape 6 · Mise en service** :
- Récap complet avec toutes les données
- Section **"Notes chantier initiales"** (réutilise le composant éditeur de `NotesChantierParc`)
- Bouton "Activer le parc" → `UPDATE parcs SET actif = true`
- Génération auto des contrôles à venir (quotidien demain, hebdo cette semaine, mensuel ce mois)

## 🎯 Priorité 3 — Compléter UtilisateursAdmin
- `ListeAValider` : charger `invitations` (utilise_le NOT NULL) joinées avec `utilisateurs` (statut_validation='en_attente')
- `ListeActifs` : table avec rôle, parcs, dernière connexion, actions (désactiver, modifier rôle, modifier parcs)
- `ListeInvitations` : invitations en cours avec actions Renvoyer/Annuler
- `ListeDesactives` : avec action Réactiver

## 🎯 Priorité 4 — Compléter les 14 pages stubs (`_stubs.tsx`)
Ouvre `src/pages/_stubs.tsx`, chaque fonction a son hook déjà importé. Tu remplis le `// TODO Bolt`. Ordre suggéré :
- `PageEquipements` (CRUD avec import CSV + bouton "+ Nouveau fournisseur" intégré)
- `PageStock` (table + alertes + commande fournisseur)
- `PageBibliotheque` (CRUD avec verrou Ryad + audit `standards_evolutifs`)
- `ControleMensuel` (réutilise `ControleEcran` + double signature binôme)
- `FicheCinqPourquoi` (5 questions séquentielles + cause racine + contre-mesure + audit 90j auto)
- `PagePlaintes` (saisie + historique, trigger SQL fait le ticket prévisionnel auto)
- `PagePreventif` (calendrier maintenances)
- `PageCertifications` (alertes échéances rouge < 30j, amber < 90j)
- `VueManagerParc` (vue dédiée manager)
- `PageProfil` (consentement GPS RGPD + changement password)
- `MesSignalements` (liste signalements staff du jour)

## 🎯 Priorité 5 — Mutations Supabase
Crée les hooks listés plus haut dans `src/hooks/mutations/`.

## 🎯 Priorité 6 — Storage Supabase
4 buckets à créer (peux-tu me guider ?) :
- `pdf_archives` (privé) · contrôles, interventions, certifications
- `photos_controles` (privé)
- `signatures` (privé)
- `photos_interventions` (privé)
- `notes_chantier` (privé) · pièces jointes des notes

Pour les photos terrain : compression côté client (max 1 Mo) + watermark date+GPS+user.

---

# Comment tu travailles avec moi

1. **Itère pas à pas** : termine UNE page, vérifie avec moi, passe à la suivante
2. **Demande-moi avant** d'inventer une logique métier non spécifiée
3. **Respecte la DA** : si tu hésites, copie le pattern d'une page existante
4. **Préviens-moi** des incohérences SQL/types — ne corrige pas silencieusement
5. **Pas de console.log oublié, pas de TODO en prod, pas de fichier inutile**
6. **Tests visuels** : à chaque feature, montre-moi le rendu en preview

---

# Première action

Commence par **brancher la page `TableauDeBord` sur les vraies vues KPI Supabase**. Remplace `kpiMock` et `alertesMock` par les vrais hooks. Affiche un skeleton ou un spinner pendant la requête. Une fois fait, montre-moi le résultat.

Puis on enchaine par ordre de priorité métier.

🎯 **Vision finale** : la première GMAO Lean Ballé du secteur loisir indoor en France. Pas un Excel amélioré, une vraie boucle d'apprentissage qui transforme chaque panne en standard évolutif.

C'est parti ! 🚀
