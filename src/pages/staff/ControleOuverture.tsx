import { useState } from 'react';
import { ControleEcran, type PointControleVue, type ZoneVue } from '@/components/controles/ControleEcran';
import type { EtatControleItem } from '@/types/database';

// ============================================================
// Page contrôle ouverture quotidien · staff opérationnel
// Réutilise le composant générique ControleEcran avec type='quotidien'
//
// Branchement Supabase :
//   1. Au démarrage : INSERT controles (type='quotidien', parc_id, date_planifiee=today)
//   2. Récupère bibliotheque_points filtrés par type_controle='quotidien'
//      ET liés aux catégories d'équipements présentes dans le parc
//      via parc_attractions
//   3. À chaque saisie : INSERT controle_items
//   4. Validation finale : UPDATE controles SET statut='valide', signature_url=...
//   5. Génération PDF horodaté SHA256 → archives_pdf
// ============================================================

// Mock zones et points · à remplacer par useQuery
const zonesMock: ZoneVue[] = [
  { code: 'accueil', label: 'Accueil', count: 8, fait: 8 },
  { code: 'sanitaires', label: 'Sanitaires', count: 6, fait: 6 },
  { code: 'trampoline', label: 'Trampoline', count: 19, fait: 14 },
  { code: 'karting', label: 'Karting', count: 8, fait: 0 },
  { code: 'bowling', label: 'Bowling', count: 6, fait: 0 },
];

const pointsMockTrampoline: PointControleVue[] = [
  { id: 'p1', libelle: 'Toile T01 · vérification visuelle générale', ordre: 1, zone: 'trampoline', bloquantSiKO: false, photoObligatoire: true, etat: 'ok', saisiPar: 'KM' },
  { id: 'p2', libelle: 'Toile T07 · mousses de protection', ordre: 7, zone: 'trampoline', bloquantSiKO: false, photoObligatoire: true, etat: 'degrade', saisiPar: 'JT' },
  { id: 'p3', libelle: 'Toile T08 · ressorts et fixations', ordre: 8, zone: 'trampoline', bloquantSiKO: true, photoObligatoire: true, norme: 'EN ISO 23659', etat: null },
  { id: 'p4', libelle: 'Toile T09 · ressorts et fixations', ordre: 9, zone: 'trampoline', bloquantSiKO: true, photoObligatoire: true, etat: null },
  { id: 'p5', libelle: "Toile T10 · zone d'accès et signalétique", ordre: 10, zone: 'trampoline', bloquantSiKO: false, photoObligatoire: false, etat: null },
];

export function ControleOuverture() {
  const [zoneActive, setZoneActive] = useState('trampoline');
  const [points, setPoints] = useState(pointsMockTrampoline);

  const setEtatPoint = (id: string, etat: EtatControleItem) => {
    setPoints((prev) => prev.map((p) => (p.id === id ? { ...p, etat, saisiPar: 'SL' } : p)));
    // TODO · INSERT controle_items via supabase
    // Sur HS, le trigger SQL auto_create_incident créera le ticket automatiquement
  };

  const totalPoints = zonesMock.reduce((sum, z) => sum + z.count, 0);
  const totalFaits = zonesMock.reduce((sum, z) => sum + z.fait, 0);
  const restants = totalPoints - totalFaits;

  return (
    <ControleEcran
      type="quotidien"
      parcCode="DOM"
      parcNom="Rosny Domus"
      contexte="Mercredi 15 avril · ouverture 10h"
      chrono="2h 18min"
      zones={zonesMock}
      pointsZoneActive={points}
      zoneActiveCode={zoneActive}
      agentActuel={{ initiales: 'SL', prenom: 'Sophie L.' }}
      onChangeZone={setZoneActive}
      onSetEtat={setEtatPoint}
      onChangerAgent={() => alert('Retour au login PIN')}
      onValider={() => alert('Validation + signature à implémenter')}
      validationDisabled={restants > 0}
      validationDisabledRaison={
        restants > 0
          ? `Disponible quand tous les points sont saisis (${restants} restants)`
          : undefined
      }
    />
  );
}
