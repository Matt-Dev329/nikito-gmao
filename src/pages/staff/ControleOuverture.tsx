import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ControleEcran, type PointControleVue, type ZoneVue } from '@/components/controles/ControleEcran';
import { ModaleQuitterSansValider } from '@/components/ui/ModaleQuitterSansValider';
import type { EtatControleItem } from '@/types/database';

const zonesMock: ZoneVue[] = [
  { code: 'accueil', label: 'Accueil', count: 8, fait: 8 },
  { code: 'sanitaires', label: 'Sanitaires', count: 6, fait: 6 },
  { code: 'trampoline', label: 'Trampoline', count: 19, fait: 14 },
  { code: 'karting', label: 'Karting', count: 8, fait: 0 },
  { code: 'bowling', label: 'Bowling', count: 6, fait: 0 },
];

const pointsMockTrampoline: PointControleVue[] = [
  { id: 'p1', libelle: 'Toile T01 \u00b7 v\u00e9rification visuelle g\u00e9n\u00e9rale', ordre: 1, zone: 'trampoline', bloquantSiKO: false, photoObligatoire: true, etat: 'ok', saisiPar: 'KM' },
  { id: 'p2', libelle: 'Toile T07 \u00b7 mousses de protection', ordre: 7, zone: 'trampoline', bloquantSiKO: false, photoObligatoire: true, etat: 'degrade', saisiPar: 'JT' },
  { id: 'p3', libelle: 'Toile T08 \u00b7 ressorts et fixations', ordre: 8, zone: 'trampoline', bloquantSiKO: true, photoObligatoire: true, norme: 'EN ISO 23659', etat: null },
  { id: 'p4', libelle: 'Toile T09 \u00b7 ressorts et fixations', ordre: 9, zone: 'trampoline', bloquantSiKO: true, photoObligatoire: true, etat: null },
  { id: 'p5', libelle: "Toile T10 \u00b7 zone d'acc\u00e8s et signal\u00e9tique", ordre: 10, zone: 'trampoline', bloquantSiKO: false, photoObligatoire: false, etat: null },
];

export function ControleOuverture() {
  const navigate = useNavigate();
  const [zoneActive, setZoneActive] = useState('trampoline');
  const [points, setPoints] = useState(pointsMockTrampoline);
  const [dirty, setDirty] = useState(false);
  const [showModale, setShowModale] = useState(false);

  const setEtatPoint = (id: string, etat: EtatControleItem) => {
    setPoints((prev) => prev.map((p) => (p.id === id ? { ...p, etat, saisiPar: 'SL' } : p)));
    setDirty(true);
  };

  const handleRetour = useCallback(() => {
    if (dirty) {
      setShowModale(true);
    } else {
      navigate('/staff/login');
    }
  }, [dirty, navigate]);

  const confirmerQuitter = () => {
    setShowModale(false);
    navigate('/staff/login');
  };

  const totalPoints = zonesMock.reduce((sum, z) => sum + z.count, 0);
  const totalFaits = zonesMock.reduce((sum, z) => sum + z.fait, 0);
  const restants = totalPoints - totalFaits;

  return (
    <>
      <ControleEcran
        type="quotidien"
        parcCode="DOM"
        parcNom="Rosny Domus"
        contexte="Mercredi 15 avril \u00b7 ouverture 10h"
        chrono="2h 18min"
        zones={zonesMock}
        pointsZoneActive={points}
        zoneActiveCode={zoneActive}
        agentActuel={{ initiales: 'SL', prenom: 'Sophie L.' }}
        onChangeZone={setZoneActive}
        onSetEtat={setEtatPoint}
        onRetour={handleRetour}
        onChangerAgent={() => alert('Retour au login PIN')}
        onValider={() => alert('Validation + signature \u00e0 impl\u00e9menter')}
        validationDisabled={restants > 0}
        validationDisabledRaison={
          restants > 0
            ? `Disponible quand tous les points sont saisis (${restants} restants)`
            : undefined
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
