import { useState } from 'react';
import { ControleEcran, type PointControleVue, type ZoneVue } from '@/components/controles/ControleEcran';
import type { EtatControleItem } from '@/types/database';

// ============================================================
// Page contrôle hebdo Heijunka · technicien
// Utilise le même composant générique que le contrôle ouverture
// Différence principale : type='hebdo', pas de chrono d'urgence,
// charge lissée sur la semaine côté planification.
// ============================================================

const zonesMock: ZoneVue[] = [
  { code: 'karting', label: 'Karting', count: 12, fait: 0 },
  { code: 'trampoline', label: 'Trampoline', count: 8, fait: 0 },
  { code: 'bowling', label: 'Bowling', count: 5, fait: 0 },
  { code: 'arcade', label: 'Arcade', count: 3, fait: 0 },
];

const pointsMock: PointControleVue[] = [
  { id: 'h1', libelle: 'Système freinage avant · réponse', ordre: 1, zone: 'karting', bloquantSiKO: true, photoObligatoire: true, norme: 'EN ISO 17929', etat: 'ok', saisiPar: 'EC' },
  { id: 'h2', libelle: 'Ceinture harnais · état + boucle', ordre: 2, zone: 'karting', bloquantSiKO: true, photoObligatoire: true, etat: 'ok', saisiPar: 'EC' },
  { id: 'h3', libelle: 'Pneus AV · usure', ordre: 3, zone: 'karting', bloquantSiKO: false, photoObligatoire: true, etat: 'degrade', saisiPar: 'EC' },
  { id: 'h4', libelle: 'Pneus AR · usure', ordre: 4, zone: 'karting', bloquantSiKO: false, photoObligatoire: true, etat: null },
  { id: 'h5', libelle: 'Phares AV · fonctionnement', ordre: 5, zone: 'karting', bloquantSiKO: false, photoObligatoire: false, etat: null },
  { id: 'h6', libelle: 'Niveau batterie', ordre: 6, zone: 'karting', bloquantSiKO: false, photoObligatoire: false, etat: null },
];

export function ControleHebdo() {
  const [zoneActive, setZoneActive] = useState('karting');
  const [points, setPoints] = useState(pointsMock);

  const setEtatPoint = (id: string, etat: EtatControleItem) => {
    setPoints((prev) => prev.map((p) => (p.id === id ? { ...p, etat, saisiPar: 'EC' } : p)));
  };

  const totalPoints = zonesMock.reduce((sum, z) => sum + z.count, 0);
  const totalFaits = zonesMock.reduce((sum, z) => sum + z.fait, 0);
  const restants = totalPoints - totalFaits;

  return (
    <ControleEcran
      type="hebdo"
      parcCode="DOM"
      parcNom="Rosny Domus"
      contexte="S16 · Lundi 13 → dimanche 19 avril"
      zones={zonesMock}
      pointsZoneActive={points}
      zoneActiveCode={zoneActive}
      agentActuel={{ initiales: 'EC', prenom: 'Emeric' }}
      onChangeZone={setZoneActive}
      onSetEtat={setEtatPoint}
      onValider={() => alert('Validation pack 7 + passage au suivant')}
      validationDisabled={restants > 0}
      validationDisabledRaison={
        restants > 0 ? `Disponible quand le pack est complet (${restants} restants)` : undefined
      }
    />
  );
}
