import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ControleEcran, type PointControleVue, type ZoneVue } from '@/components/controles/ControleEcran';
import { ModaleQuitterSansValider } from '@/components/ui/ModaleQuitterSansValider';
import type { EtatControleItem } from '@/types/database';

const zonesMock: ZoneVue[] = [
  { code: 'karting', label: 'Karting', count: 12, fait: 0 },
  { code: 'trampoline', label: 'Trampoline', count: 8, fait: 0 },
  { code: 'bowling', label: 'Bowling', count: 5, fait: 0 },
  { code: 'arcade', label: 'Arcade', count: 3, fait: 0 },
];

const pointsMock: PointControleVue[] = [
  { id: 'h1', libelle: 'Syst\u00e8me freinage avant \u00b7 r\u00e9ponse', ordre: 1, zone: 'karting', bloquantSiKO: true, photoObligatoire: true, norme: 'EN ISO 17929', etat: 'ok', saisiPar: 'EC' },
  { id: 'h2', libelle: 'Ceinture harnais \u00b7 \u00e9tat + boucle', ordre: 2, zone: 'karting', bloquantSiKO: true, photoObligatoire: true, etat: 'ok', saisiPar: 'EC' },
  { id: 'h3', libelle: 'Pneus AV \u00b7 usure', ordre: 3, zone: 'karting', bloquantSiKO: false, photoObligatoire: true, etat: 'degrade', saisiPar: 'EC' },
  { id: 'h4', libelle: 'Pneus AR \u00b7 usure', ordre: 4, zone: 'karting', bloquantSiKO: false, photoObligatoire: true, etat: null },
  { id: 'h5', libelle: 'Phares AV \u00b7 fonctionnement', ordre: 5, zone: 'karting', bloquantSiKO: false, photoObligatoire: false, etat: null },
  { id: 'h6', libelle: 'Niveau batterie', ordre: 6, zone: 'karting', bloquantSiKO: false, photoObligatoire: false, etat: null },
];

export function ControleHebdo() {
  const navigate = useNavigate();
  const [zoneActive, setZoneActive] = useState('karting');
  const [points, setPoints] = useState(pointsMock);
  const [dirty, setDirty] = useState(false);
  const [showModale, setShowModale] = useState(false);

  const setEtatPoint = (id: string, etat: EtatControleItem) => {
    setPoints((prev) => prev.map((p) => (p.id === id ? { ...p, etat, saisiPar: 'EC' } : p)));
    setDirty(true);
  };

  const handleRetour = useCallback(() => {
    if (dirty) {
      setShowModale(true);
    } else {
      navigate('/operations');
    }
  }, [dirty, navigate]);

  const confirmerQuitter = () => {
    setShowModale(false);
    navigate('/operations');
  };

  const totalPoints = zonesMock.reduce((sum, z) => sum + z.count, 0);
  const totalFaits = zonesMock.reduce((sum, z) => sum + z.fait, 0);
  const restants = totalPoints - totalFaits;

  return (
    <>
      <ControleEcran
        type="hebdo"
        parcCode="DOM"
        parcNom="Rosny Domus"
        contexte="S16 \u00b7 Lundi 13 \u2192 dimanche 19 avril"
        zones={zonesMock}
        pointsZoneActive={points}
        zoneActiveCode={zoneActive}
        agentActuel={{ initiales: 'EC', prenom: 'Emeric' }}
        onChangeZone={setZoneActive}
        onSetEtat={setEtatPoint}
        onRetour={handleRetour}
        onValider={() => alert('Validation pack 7 + passage au suivant')}
        validationDisabled={restants > 0}
        validationDisabledRaison={
          restants > 0 ? `Disponible quand le pack est complet (${restants} restants)` : undefined
        }
      />
      <ModaleQuitterSansValider
        open={showModale}
        onConfirmer={confirmerQuitter}
        onAnnuler={() => setShowModale(false)}
      />
    </>
  );
}
