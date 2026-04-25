import { useState, useCallback, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ControleEcran, type PointControleVue, type ZoneVue } from '@/components/controles/ControleEcran';
import { ModaleQuitterSansValider } from '@/components/ui/ModaleQuitterSansValider';
import { ModaleSignalerV2 } from '@/components/forms/ModaleSignalerV2';
import { SelectionParc } from '@/components/controles/SelectionParc';
import { BoutonRetourGmao } from '@/components/controles/BoutonRetourGmao';
import { useAuth } from '@/hooks/useAuth';
import { useParcs } from '@/hooks/queries/useReferentiel';
import { usePointsControle, useValiderControle } from '@/hooks/queries/useControles';
import type { EtatControleItem } from '@/types/database';

function formatDuree(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`;
  return `${m}min`;
}

export function ControleOuverture() {
  const navigate = useNavigate();
  const { utilisateur } = useAuth();
  const { data: allParcs } = useParcs();

  const [parcChoisi, setParcChoisi] = useState<{ id: string; code: string; nom: string } | null>(null);

  const handleSelectParc = useCallback((p: { id: string; code: string; nom: string }) => {
    setParcChoisi(p);
  }, []);

  const parcId = parcChoisi?.id;
  const parc = parcChoisi ?? allParcs?.find((p) => p.id === parcId);

  const { data: pointsBruts, isLoading } = usePointsControle(parcId, 'quotidien');
  const validerMutation = useValiderControle();

  const [startTime] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const [etats, setEtats] = useState<Record<string, { etat: EtatControleItem; saisiPar: string }>>({});
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [zoneActive, setZoneActive] = useState<string>('');
  const [dirty, setDirty] = useState(false);
  const [showModale, setShowModale] = useState(false);
  const [showSignaler, setShowSignaler] = useState(false);
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
        photoUrl: photoUrls[p.point_id],
      }));
  }, [pointsBruts, activeZone, etats, photoUrls]);

  const trigramme = utilisateur?.trigramme ?? utilisateur?.prenom?.slice(0, 2).toUpperCase() ?? '??';

  const setEtatPoint = (id: string, etat: EtatControleItem) => {
    setEtats((prev) => ({ ...prev, [id]: { etat, saisiPar: trigramme } }));
    setDirty(true);
  };

  const handlePhotoUploaded = useCallback((pointId: string, url: string) => {
    setPhotoUrls((prev) => ({ ...prev, [pointId]: url }));
    setDirty(true);
  }, []);

  const retourDestination = utilisateur?.role_code === 'staff_operationnel' ? '/staff/login' : '/gmao';

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

    const datePlanifiee = new Date().toISOString().slice(0, 10);

    const items = pointsBruts
      .filter((p) => etats[p.point_id])
      .map((p) => ({
        point_id: p.point_id,
        etat: etats[p.point_id].etat,
        photo_url: photoUrls[p.point_id] ?? null,
      }));

    await validerMutation.mutateAsync({
      parc_id: parcId,
      type: 'quotidien',
      date_planifiee: datePlanifiee,
      realise_par_id: utilisateur.id,
      realise_par_nom: `${utilisateur.prenom} ${utilisateur.nom}`,
      realise_par_role: utilisateur.role_code,
      items,
    });

    setValidated(true);
  };

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  if (!parcChoisi) {
    return (
      <SelectionParc
        titre="Controle d'ouverture"
        onSelect={handleSelectParc}
      />
    );
  }

  const signalBouton = (
    <button
      onClick={() => setShowSignaler(true)}
      className="bg-red/10 border border-red/30 text-red px-3 py-2 rounded-[10px] text-[12px] font-semibold min-h-[44px] hover:bg-red/20 transition-colors flex items-center gap-1.5"
    >
      <AlertTriangleIcon className="w-3.5 h-3.5" />
      Signaler une panne
    </button>
  );

  if (isLoading) {
    return (
      <div className="p-6 text-dim text-sm">Chargement des points de controle...</div>
    );
  }

  if (!pointsBruts?.length) {
    return (
      <div className="p-6">
        <div className="text-dim text-sm">
          Aucun point de controle quotidien configure pour ce parc.
        </div>
        <button
          onClick={() => navigate(retourDestination)}
          className="text-nikito-cyan text-sm mt-3"
        >
          Retour
        </button>
      </div>
    );
  }

  if (validated) {
    return (
      <div className="p-6 text-center">
        <div className="text-4xl mb-3">OK</div>
        <div className="text-lg font-semibold mb-1">Controle ouverture valide</div>
        <div className="text-dim text-sm mb-4">{totalFaits} points controles - {today}</div>
        <button
          onClick={() => navigate(retourDestination)}
          className="bg-gradient-cta text-text px-6 py-3 rounded-[10px] text-[13px] font-bold min-h-[44px]"
        >
          Retour
        </button>
      </div>
    );
  }

  return (
    <>
      <ControleEcran
        type="quotidien"
        parcCode={parc?.code ?? ''}
        parcNom={parc?.nom ?? ''}
        contexte={`${today} - ouverture`}
        chrono={formatDuree(elapsed)}
        zones={zones}
        pointsZoneActive={pointsZoneActive}
        zoneActiveCode={activeZone}
        agentActuel={{ initiales: trigramme, prenom: utilisateur?.prenom ?? '' }}
        onChangeZone={setZoneActive}
        onSetEtat={setEtatPoint}
        onPhotoUploaded={handlePhotoUploaded}
        onRetour={handleRetour}
        onChangerAgent={() => navigate('/staff/login')}
        onValider={handleValider}
        validationDisabled={restants > 0 || validerMutation.isPending}
        validationDisabledRaison={
          validerMutation.isPending
            ? 'Enregistrement en cours...'
            : restants > 0
              ? `Disponible quand tous les points sont saisis (${restants} restants)`
              : undefined
        }
        headerRightSlot={
          <div className="flex items-center gap-1.5">
            {signalBouton}
            <BoutonRetourGmao />
          </div>
        }
      />
      <ModaleQuitterSansValider
        open={showModale}
        onConfirmer={confirmerQuitter}
        onAnnuler={() => setShowModale(false)}
      />
      <ModaleSignalerV2
        open={showSignaler}
        onClose={() => setShowSignaler(false)}
        via="tablette_signalement"
        parcId={parcId}
      />
    </>
  );
}

function AlertTriangleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 1.5L1 14h14L8 1.5z" />
      <path d="M8 6v3" />
      <circle cx="8" cy="11.5" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}
