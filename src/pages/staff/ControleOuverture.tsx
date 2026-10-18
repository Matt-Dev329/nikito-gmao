import { useState, useCallback, useMemo, useEffect } from 'react';
import { aujourdhuiParis } from '@/lib/dates';
import { estErreurReseau, mettreActionEnFile } from '@/lib/horsLigne/file';
import { useNavigate } from 'react-router-dom';
import { BoutonActualiser } from '@/components/ui/BoutonActualiser';
import { ControleEcran, photoManquante, type PointControleVue, type ZoneVue } from '@/components/controles/ControleEcran';
import { ModaleQuitterSansValider } from '@/components/ui/ModaleQuitterSansValider';
import { ModaleSignalerV2 } from '@/components/forms/ModaleSignalerV2';
import { SelectionParc } from '@/components/controles/SelectionParc';
import { BoutonRetourGmao } from '@/components/controles/BoutonRetourGmao';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/components/ui/ToastProvider';
import { useDraftPersistence, useAutoSaveDraft } from '@/hooks/useDraftPersistence';
import { useParcs } from '@/hooks/queries/useReferentiel';
import { usePointsControle } from '@/hooks/queries/useControles';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { validerZoneControle, type PayloadControleZone } from '@/lib/horsLigne/executeurs';
import type { EtatControleItem, TypeControle } from '@/types/database';

function formatDuree(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`;
  return `${m}min`;
}

interface StaffSessionData {
  utilisateur: {
    utilisateur_id?: string;
    id?: string;
    prenom: string;
    nom: string;
    trigramme: string | null;
    role_code: string;
    pin_must_change: boolean;
  };
  parc: { id: string; code: string; nom: string };
}

function loadStaffSession(): StaffSessionData | null {
  try {
    const raw = sessionStorage.getItem('staff_session');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

function getStaffUserId(u: StaffSessionData['utilisateur']): string {
  return u.utilisateur_id ?? u.id ?? '';
}

const TYPE_LABELS: Record<TypeControle, {
  titre: string;
  court: string;
  valide: string;
  autreRoute: string;
  autreLabel: string;
}> = {
  quotidien: { titre: "Controle d'ouverture", court: 'ouverture', valide: 'Controle ouverture valide', autreRoute: '/staff/controle-hebdo', autreLabel: 'Passer en hebdo' },
  hebdo: { titre: 'Controle hebdomadaire', court: 'hebdo', valide: 'Controle hebdo valide', autreRoute: '/staff/controle-ouverture', autreLabel: "Passer en ouverture" },
  mensuel: { titre: 'Controle mensuel', court: 'mensuel', valide: 'Controle mensuel valide', autreRoute: '/staff/controle-ouverture', autreLabel: 'Passer en ouverture' },
};

export function ControleOuverture({ typeControle = 'quotidien' }: { typeControle?: TypeControle } = {}) {
  const L = TYPE_LABELS[typeControle];
  const navigate = useNavigate();
  const { utilisateur: authUtilisateur } = useAuth();
  const { data: allParcs } = useParcs();

  const staffSession = loadStaffSession();
  const utilisateur = authUtilisateur ?? (staffSession ? {
    id: getStaffUserId(staffSession.utilisateur),
    email: '',
    nom: staffSession.utilisateur.nom,
    prenom: staffSession.utilisateur.prenom,
    trigramme: staffSession.utilisateur.trigramme,
    role_code: (staffSession.utilisateur.role_code || 'staff_operationnel') as 'staff_operationnel',
    parc_ids: [staffSession.parc.id],
    consentement_gps: false,
  } : null);

  const [parcChoisi, setParcChoisi] = useState<{ id: string; code: string; nom: string } | null>(
    staffSession?.parc ?? null
  );

  const handleSelectParc = useCallback((p: { id: string; code: string; nom: string }) => {
    setParcChoisi(p);
  }, []);

  const parcId = parcChoisi?.id;
  const parc = parcChoisi ?? allParcs?.find((p) => p.id === parcId);

  const { data: pointsBruts, isLoading } = usePointsControle(parcId, typeControle);
  const qc = useQueryClient();
  // Contrôle validé zone par zone (zone = activité) : chacun peut valider sa zone
  const datePeriode = aujourdhuiParis();
  const { data: zonesValidees } = useQuery({
    queryKey: ['zones_validees', parcId, typeControle, datePeriode],
    enabled: !!parcId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('zones_validees_controle', {
        p_parc_id: parcId,
        p_type: typeControle,
        p_date_planifiee: datePeriode,
      });
      if (error) throw error;
      return (data ?? []) as { categorie_id: string; par: string; le: string; controle_valide: boolean }[];
    },
  });
  const validerMutation = useMutation({
    mutationFn: (payload: PayloadControleZone) => validerZoneControle(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['zones_validees'] });
      qc.invalidateQueries({ queryKey: ['controles'] });
      qc.invalidateQueries({ queryKey: ['historique_controles'] });
    },
  });

  const [startTime] = useState(() => Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [validated, setValidated] = useState(false);
  const [valideHorsLigne, setValideHorsLigne] = useState(false);
  useEffect(() => {
    if (validated) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, validated]);

  const [etats, setEtats] = useState<Record<string, { etat: EtatControleItem; saisiPar: string }>>({});
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({});
  const [commentaires, setCommentaires] = useState<Record<string, string>>({});
  const [zoneActive, setZoneActive] = useState<string>('');
  const [dirty, setDirty] = useState(false);
  const [showModale, setShowModale] = useState(false);
  const [showSignaler, setShowSignaler] = useState(false);
  const [erreurValidation, setErreurValidation] = useState<string | null>(null);
  const [derniereZone, setDerniereZone] = useState<string | null>(null);
  // Zones validées sans réseau : en file d'envoi, affichées comme validées sur cet appareil
  const [zonesHorsLigne, setZonesHorsLigne] = useState<Record<string, string>>({});
  const toast = useToast();

  const draftKey = parcId
    ? `controle-${typeControle}:${parcId}:${aujourdhuiParis()}`
    : null;
  const draft = useDraftPersistence<{
    etats: Record<string, { etat: EtatControleItem; saisiPar: string }>;
    photoUrls: Record<string, string>;
    commentaires: Record<string, string>;
  }>(draftKey);
  const [draftLoaded, setDraftLoaded] = useState(false);

  if (parcId && !draftLoaded) {
    const d = draft.restore();
    if (d) {
      setEtats(d.etats ?? {});
      setPhotoUrls(d.photoUrls ?? {});
      setCommentaires(d.commentaires ?? {});
      setDirty(true);
    }
    setDraftLoaded(true);
  }

  // Sauvegarde automatique des points saisis (anti-perte réseau/veille terrain).
  const valeursBrouillon = useMemo(
    () => ({ etats, photoUrls, commentaires }),
    [etats, photoUrls, commentaires]
  );
  useAutoSaveDraft(draft.save, valeursBrouillon, dirty && !validated);

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
    return Array.from(map.values()).map((z) => {
      const v =
        zonesValidees?.find((zv) => zv.categorie_id === z.code) ??
        (zonesHorsLigne[z.code] ? { par: 'cet appareil (envoi en attente)', le: zonesHorsLigne[z.code] } : undefined);
      return {
        ...z,
        fait: v ? z.count : pointsBruts.filter((p) => p.categorie_id === z.code && etats[p.point_id]).length,
        validee: v ? { par: v.par, le: v.le } : null,
      };
    });
  }, [pointsBruts, etats, zonesValidees, zonesHorsLigne]);

  // Par défaut : la première zone pas encore validée
  const activeZone = zoneActive || zones.find((z) => !z.validee)?.code || zones[0]?.code || '';
  const zoneActiveVue = zones.find((z) => z.code === activeZone);
  const toutesZonesValidees = zones.length > 0 && zones.every((z) => z.validee);

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
        commentaire: commentaires[p.point_id],
      }));
  }, [pointsBruts, activeZone, etats, photoUrls, commentaires]);

  const trigramme = utilisateur?.trigramme ?? utilisateur?.prenom?.slice(0, 2).toUpperCase() ?? '??';

  const setEtatPoint = (id: string, etat: EtatControleItem) => {
    setEtats((prev) => ({ ...prev, [id]: { etat, saisiPar: trigramme } }));
    setDirty(true);
  };

  const handlePhotoUploaded = useCallback((pointId: string, url: string) => {
    setPhotoUrls((prev) => ({ ...prev, [pointId]: url }));
    setDirty(true);
  }, []);

  const handleCommentaire = useCallback((pointId: string, commentaire: string) => {
    setCommentaires((prev) => ({ ...prev, [pointId]: commentaire }));
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

  const totalFaits = zones.reduce((sum, z) => sum + z.fait, 0);
  const restants = zoneActiveVue ? zoneActiveVue.count - zoneActiveVue.fait : 0;
  const photosManquantes = (pointsBruts ?? []).filter((p) =>
    p.categorie_id === activeZone &&
    photoManquante({
      id: p.point_id,
      libelle: p.libelle,
      ordre: p.ordre,
      zone: p.categorie_id,
      bloquantSiKO: p.bloquant,
      photoObligatoire: p.photo_obligatoire,
      etat: etats[p.point_id]?.etat ?? null,
      photoUrl: photoUrls[p.point_id],
    })
  ).length;

  const handleValider = async () => {
    if (!parcId || !utilisateur || !utilisateur.id || !pointsBruts || !zoneActiveVue) return;
    setErreurValidation(null);

    const payload: PayloadControleZone = {
      p_parc_id: parcId,
      p_type: typeControle,
      p_date_planifiee: datePeriode,
      p_realise_par_id: utilisateur.id,
      p_realise_par_nom: `${utilisateur.prenom} ${utilisateur.nom}`,
      p_realise_par_role: utilisateur.role_code,
      p_zone: activeZone,
      p_items: pointsBruts
        .filter((p) => p.categorie_id === activeZone && etats[p.point_id])
        .map((p) => ({
          point_id: p.point_id,
          etat: etats[p.point_id].etat,
          commentaire: commentaires[p.point_id] || null,
          photo_url: photoUrls[p.point_id] ?? null,
        })),
    };
    const zonesRestantes = zones.filter((z) => !z.validee && z.code !== activeZone);

    const apresZone = (complet: boolean) => {
      setDerniereZone(zoneActiveVue.label);
      toast.success(`Zone ${zoneActiveVue.label} validée`);
      if (complet || zonesRestantes.length === 0) {
        draft.clear();
        setDirty(false);
        setValidated(true);
      } else {
        setZoneActive(zonesRestantes[0].code);
      }
    };

    try {
      const res = await validerMutation.mutateAsync(payload);
      apresZone(res.complet);
    } catch (err: unknown) {
      // Sans réseau : la zone est gardée sur l'appareil et envoyée automatiquement
      if (estErreurReseau(err)) {
        try {
          await mettreActionEnFile(
            'controle_zone',
            `${L.titre} · ${parc?.code ?? ''} · ${zoneActiveVue.label} · ${datePeriode}`,
            payload
          );
          setValideHorsLigne(true);
          setZonesHorsLigne((prev) => ({ ...prev, [activeZone]: new Date().toISOString() }));
          apresZone(false);
          return;
        } catch {
          // stockage local indisponible : on affiche l'erreur réseau
        }
      }
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      setErreurValidation(msg);
    }
  };

  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  if (!parcChoisi) {
    return (
      <SelectionParc
        titre={L.titre}
        onSelect={handleSelectParc}
      />
    );
  }

  // Le staff fait les contrôles mais ne crée pas de tickets
  const estStaff = utilisateur?.role_code === 'staff_operationnel';
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
          Aucun point de controle {L.court} configure pour ce parc.
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

  if (validated || toutesZonesValidees) {
    return (
      <div className="p-6 text-center">
        <div className="text-4xl mb-3">OK</div>
        <div className="text-lg font-semibold mb-1">{L.valide}</div>
        <div className="text-dim text-sm mb-4">
          {totalFaits} points controles - {today}
          {derniereZone && validated && <><br />Dernière zone validée : {derniereZone}</>}
        </div>
        {valideHorsLigne && (
          <div className="text-amber text-[13px] mb-4 max-w-[420px] mx-auto">
            Enregistré sur la tablette (hors connexion) : il sera envoyé automatiquement au retour du réseau. Laisse
            l'application ouverte ou rouvre-la une fois connecté.
          </div>
        )}
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
        type={typeControle}
        parcCode={parc?.code ?? ''}
        parcNom={parc?.nom ?? ''}
        contexte={`${today} - ${L.court}`}
        chrono={formatDuree(elapsed)}
        zones={zones}
        pointsZoneActive={pointsZoneActive}
        zoneActiveCode={activeZone}
        agentActuel={{ initiales: trigramme, prenom: utilisateur?.prenom ?? '' }}
        onChangeZone={setZoneActive}
        onSetEtat={setEtatPoint}
        onPhotoUploaded={handlePhotoUploaded}
        onCommentaire={handleCommentaire}
        onRetour={handleRetour}
        onChangerAgent={() => navigate('/staff/login')}
        onValider={handleValider}
        validationLabel={`Valider la zone ${zoneActiveVue?.label ?? ''} · signature electronique`}
        validationDisabled={restants > 0 || photosManquantes > 0 || validerMutation.isPending}
        validationDisabledRaison={
          validerMutation.isPending
            ? 'Enregistrement en cours...'
            : erreurValidation
              ? erreurValidation
              : restants > 0
                ? `Disponible quand tous les points de la zone sont saisis (${restants} restants)`
                : photosManquantes > 0
                  ? `Photo obligatoire manquante (${photosManquantes} point${photosManquantes > 1 ? 's' : ''})`
                  : undefined
        }
        headerRightSlot={
          <div className="flex items-center gap-1.5">
            <BoutonActualiser className="w-8 h-8 text-[16px]" />
            <button
              onClick={() => { setParcChoisi(null); navigate(L.autreRoute); }}
              className="text-[11px] text-nikito-cyan hover:underline whitespace-nowrap"
            >
              {L.autreLabel}
            </button>
            {!estStaff && signalBouton}
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
