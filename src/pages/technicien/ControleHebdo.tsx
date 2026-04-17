import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ControleEcran, type PointControleVue, type ZoneVue } from '@/components/controles/ControleEcran';
import { ModaleQuitterSansValider } from '@/components/ui/ModaleQuitterSansValider';
import { SelectionParc } from '@/components/controles/SelectionParc';
import { BoutonRetourGmao } from '@/components/controles/BoutonRetourGmao';
import { useAuth } from '@/hooks/useAuth';
import { useParcs } from '@/hooks/queries/useReferentiel';
import { usePointsControle, useValiderControle } from '@/hooks/queries/useControles';
import type { EtatControleItem } from '@/types/database';

export function ControleHebdo() {
  const navigate = useNavigate();
  const { utilisateur } = useAuth();
  const { data: allParcs } = useParcs();

  const [parcChoisi, setParcChoisi] = useState<{ id: string; code: string; nom: string } | null>(null);

  const handleSelectParc = useCallback((p: { id: string; code: string; nom: string }) => {
    setParcChoisi(p);
  }, []);

  const parcId = parcChoisi?.id;
  const parc = parcChoisi ?? allParcs?.find((p) => p.id === parcId);

  const { data: pointsBruts, isLoading } = usePointsControle(parcId, 'hebdo');
  const validerMutation = useValiderControle();

  const [etats, setEtats] = useState<Record<string, { etat: EtatControleItem; saisiPar: string }>>({});
  const [zoneActive, setZoneActive] = useState<string>('');
  const [dirty, setDirty] = useState(false);
  const [showModale, setShowModale] = useState(false);
  const [validated, setValidated] = useState(false);

  const zones: ZoneVue[] = useMemo(() => {
    if (!pointsBruts?.length) return [];
    const map = new Map<string, { code: string; label: string; count: number }>();
    for (const p of pointsBruts) {
      const existing = map.get(p.categorie_id);
      if (existing) {
        existing.count++;
      } else {
        map.set(p.categorie_id, { code: p.categorie_id, label: p.categorie_nom, count: 1 });
      }
    }
    return Array.from(map.values()).map((z) => ({
      ...z,
      fait: pointsBruts.filter((p) => p.categorie_id === z.code && etats[p.point_id]).length,
    }));
  }, [pointsBruts, etats]);

  const activeZone = zoneActive || zones[0]?.code || '';

  const pointsZoneActive: PointControleVue[] = useMemo(() => {
    if (!pointsBruts) return [];
    return pointsBruts
      .filter((p) => p.categorie_id === activeZone)
      .map((p) => ({
        id: p.point_id,
        libelle: p.libelle,
        ordre: p.ordre,
        zone: p.categorie_id,
        bloquantSiKO: p.bloquant,
        photoObligatoire: p.photo_obligatoire,
        etat: etats[p.point_id]?.etat ?? null,
        saisiPar: etats[p.point_id]?.saisiPar,
      }));
  }, [pointsBruts, activeZone, etats]);

  const trigramme = utilisateur?.trigramme ?? utilisateur?.prenom?.slice(0, 2).toUpperCase() ?? '??';

  const setEtatPoint = (id: string, etat: EtatControleItem) => {
    setEtats((prev) => ({ ...prev, [id]: { etat, saisiPar: trigramme } }));
    setDirty(true);
  };

  const retourDestination = utilisateur?.role_code === 'technicien' ? '/tech/operations' : '/gmao';

  const handleRetour = useCallback(() => {
    if (dirty) {
      setShowModale(true);
    } else {
      navigate(retourDestination);
    }
  }, [dirty, navigate, retourDestination]);

  const confirmerQuitter = () => {
    setShowModale(false);
    navigate(retourDestination);
  };

  const totalPoints = zones.reduce((sum, z) => sum + z.count, 0);
  const totalFaits = zones.reduce((sum, z) => sum + z.fait, 0);
  const restants = totalPoints - totalFaits;

  const handleValider = async () => {
    if (!parcId || !utilisateur || !pointsBruts) return;

    const now = new Date();
    const lundi = new Date(now);
    lundi.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    const datePlanifiee = lundi.toISOString().slice(0, 10);

    const items = pointsBruts
      .filter((p) => etats[p.point_id])
      .map((p) => ({
        point_id: p.point_id,
        etat: etats[p.point_id].etat,
      }));

    await validerMutation.mutateAsync({
      parc_id: parcId,
      type: 'hebdo',
      date_planifiee: datePlanifiee,
      realise_par_id: utilisateur.id,
      realise_par_nom: `${utilisateur.prenom} ${utilisateur.nom}`,
      realise_par_role: utilisateur.role_code,
      items,
    });

    setValidated(true);
  };

  const now = new Date();
  const getWeekNumber = (d: Date) => {
    const onejan = new Date(d.getFullYear(), 0, 1);
    return Math.ceil(((d.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7);
  };
  const semaine = `S${getWeekNumber(now)}`;

  if (!parcChoisi) {
    return (
      <SelectionParc
        titre="Controle hebdomadaire"
        onSelect={handleSelectParc}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 text-dim text-sm">Chargement des points de controle...</div>
    );
  }

  if (!pointsBruts?.length) {
    return (
      <div className="p-6">
        <div className="text-dim text-sm">
          Aucun point de controle hebdomadaire configure pour ce parc.
        </div>
        <button
          onClick={() => navigate(retourDestination)}
          className="text-nikito-cyan text-sm mt-3"
        >
          Retour aux operations
        </button>
      </div>
    );
  }

  if (validated) {
    return (
      <div className="p-6 text-center">
        <div className="text-4xl mb-3">OK</div>
        <div className="text-lg font-semibold mb-1">Controle hebdo valide</div>
        <div className="text-dim text-sm mb-4">{totalFaits} points controles - {semaine}</div>
        <button
          onClick={() => navigate(retourDestination)}
          className="bg-gradient-cta text-text px-6 py-3 rounded-[10px] text-[13px] font-bold min-h-[44px]"
        >
          Retour aux operations
        </button>
      </div>
    );
  }

  return (
    <>
      <ControleEcran
        type="hebdo"
        parcCode={parc?.code ?? ''}
        parcNom={parc?.nom ?? ''}
        contexte={`${semaine} - Controle hebdomadaire`}
        zones={zones}
        pointsZoneActive={pointsZoneActive}
        zoneActiveCode={activeZone}
        agentActuel={{ initiales: trigramme, prenom: utilisateur?.prenom ?? '' }}
        onChangeZone={setZoneActive}
        onSetEtat={setEtatPoint}
        onRetour={handleRetour}
        onValider={handleValider}
        validationDisabled={restants > 0 || validerMutation.isPending}
        validationDisabledRaison={
          validerMutation.isPending
            ? 'Enregistrement en cours...'
            : restants > 0
              ? `Disponible quand le pack est complet (${restants} restants)`
              : undefined
        }
        headerRightSlot={<BoutonRetourGmao />}
      />
      <ModaleQuitterSansValider
        open={showModale}
        onConfirmer={confirmerQuitter}
        onAnnuler={() => setShowModale(false)}
      />
    </>
  );
}
