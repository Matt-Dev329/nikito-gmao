import { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TabletHeader } from '@/components/layout/TabletHeader';
import { CritTag } from '@/components/ui/CritTag';
import { PhotoCapture } from '@/components/shared/PhotoCapture';
import { PhotosMultiples } from '@/components/shared/PhotosMultiples';
import { ModaleQuitterSansValider } from '@/components/ui/ModaleQuitterSansValider';
import { ModalePauseTicket } from '@/components/tickets/ModalePauseTicket';
import { ModaleAjouterPiece } from '@/components/shared/ModaleAjouterPiece';
import { useAccesCommandes } from '@/hooks/queries/useCommandes';
import { useChrono } from '@/hooks/useChrono';
import { useIncident, useDemarrerIntervention, useValiderTicket } from '@/hooks/queries/useTickets';
import { ModaleSupprimerTicket } from '@/components/tickets/ModaleSupprimerTicket';
import { ModaleRefuserTicket } from '@/components/tickets/ModaleRefuserTicket';
import { ModaleRouvrirTicket } from '@/components/tickets/ModaleRouvrirTicket';
import { NotesPartagees } from '@/components/shared/NotesPartagees';
import { peutValiderTicket } from '@/lib/acces';
import { useCloturerIntervention } from '@/hooks/mutations';
import { ChoixTestActivite } from '@/components/tickets/ChoixTestActivite';
import { useAuth } from '@/hooks/useAuth';
import { useDraftPersistence, useAutoSaveDraft } from '@/hooks/useDraftPersistence';
import { useToast } from '@/components/ui/ToastProvider';
import { useSignedUrl } from '@/hooks/useSignedUrl';
import { supabase } from '@/lib/supabase';
import { PanneauIntervenantExterieur } from '@/components/tickets/PanneauIntervenantExterieur';
import { PanneauAttentePiece } from '@/components/tickets/PanneauAttentePiece';
import { PhotosTicket } from '@/components/tickets/PhotosTicket';
import { estErreurReseau, mettreActionEnFile } from '@/lib/horsLigne/file';
import { exportInterventionPDF } from './exportInterventionPDF';
import { formatChrono, cn, estCheminVideo } from '@/lib/utils';
import type { Criticite } from '@/types/database';

type Etape = 'diagnostic' | 'pieces' | 'actions' | 'cloture';
const etapes: { code: Etape; label: string }[] = [
  { code: 'diagnostic', label: 'Diagnostic' },
  { code: 'pieces', label: 'Pièces' },
  { code: 'actions', label: 'Actions' },
  { code: 'cloture', label: 'Clôture' },
];

interface PieceUtilisee {
  id: string;
  nom: string;
  reference: string;
  stockApres: number;
  quantite: number;
}

/** Pièce ajoutée pendant la saisie, sortie du stock à la clôture */
interface PieceAjoutee {
  pieceId: string;
  nom: string;
  reference: string;
  stock: number;
  quantite: number;
}

export function Intervention() {
  const { btNumero } = useParams();
  const navigate = useNavigate();
  const { utilisateur } = useAuth();
  // Phase de test : la saisie des pièces utilisées n'est ouverte qu'aux chefs d'équipe
  const { estGestionnaire: saisiePiecesActive } = useAccesCommandes();
  const cloturer = useCloturerIntervention();

  const { data: incident, isLoading } = useIncident(btNumero);

  const equip = incident?.equipements as Record<string, unknown> | null;
  const priorite = incident?.niveaux_priorite as Record<string, unknown> | null;
  const zone = equip?.zones as Record<string, unknown> | null;
  const parc = equip?.parcs as Record<string, unknown> | null;
  const interventions = (incident?.interventions ?? []) as Record<string, unknown>[];

  const statutIncident = (incident?.statut as string | undefined) ?? '';
  // Validation (tickets du staff / managers non principaux) et suppression avec motif
  const enAttenteValidation = incident?.validation_manager === 'en_attente' && statutIncident !== 'annule';
  const estAnnule = statutIncident === 'annule';
  // Ticket sans équipement (saisi à la main) : parc du déclarant
  const peutValider = peutValiderTicket(utilisateur, (equip?.parc_id ?? incident?.parc_ticket) as string | undefined);
  const validerTicket = useValiderTicket();
  const [suppression, setSuppression] = useState(false);
  const [refus, setRefus] = useState(false);
  const estResolu = statutIncident === 'resolu' || statutIncident === 'ferme';
  // Réouverture : chef d'équipe uniquement (cf RPC rouvrir_ticket)
  const peutRouvrir = utilisateur?.role_code === 'chef_maintenance';
  const [reouverture, setReouverture] = useState(false);
  const reouvertures = ((incident?.meta as { reouvertures?: { le: string; par_nom?: string; motif: string }[] } | null)?.reouvertures ?? []);
  // Intervention en cours (fin vide) ; pour un ticket résolu, la dernière intervention.
  // Une intervention déjà clôturée d'un ticket rouvert ne doit pas être reprise ni écrasée.
  const latestIntervention = useMemo(() => {
    if (!interventions.length) return null;
    const triees = [...interventions].sort((a, b) => {
      const da = new Date(a.cree_le as string).getTime();
      const db = new Date(b.cree_le as string).getTime();
      return db - da;
    });
    return triees.find((i) => !i.fin) ?? (estResolu ? triees[0] : null);
  }, [interventions, estResolu]);

  const demarrer = useDemarrerIntervention();
  // Photo (ou vidéo) prise à la création du ticket : sert de photo AVANT (sinon elle est obligatoire)
  const mediasSignalement = ((incident?.photos_urls as string[] | null) ?? []).filter(Boolean);
  const photoSignalement = mediasSignalement.find((c) => !estCheminVideo(c)) ?? mediasSignalement[0] ?? null;
  const signalementVideo = estCheminVideo(photoSignalement);
  const { data: urlPhotoSignalement } = useSignedUrl(photoSignalement, 'alba-incidents');
  const [autrePhoto, setAutrePhoto] = useState(false);
  const [copiePhoto, setCopiePhoto] = useState(false);

  /** Recopie la photo du signalement dans le dossier de l'intervention (photo AVANT).
   *  Pour une vidéo, une image en est extraite. */
  const copierPhotoSignalement = async (chemin: string): Promise<string> => {
    const { data, error } = await supabase.storage.from('alba-incidents').download(chemin);
    if (error || !data) throw new Error('Photo du signalement inaccessible : prends une nouvelle photo');
    const image = estCheminVideo(chemin) ? await imageDepuisVideo(data) : data;
    const cible = `intervention/${btNumero ?? 'draft'}/avant_signalement_${Date.now()}.jpg`;
    const { error: upErr } = await supabase.storage
      .from('alba-interventions')
      .upload(cible, image, { contentType: image.type || 'image/jpeg' });
    if (upErr) throw upErr;
    return cible;
  };

  const demarrerIntervention = async () => {
    if (!incident?.id) return;
    let photo = photoAvant;
    if (!photo && photoSignalement && !autrePhoto) {
      setCopiePhoto(true);
      try {
        photo = await copierPhotoSignalement(photoSignalement);
        setPhotosAvant([photo]);
        setDirty(true);
      } catch (e) {
        toast.error((e as Error).message);
        setAutrePhoto(true);
        return;
      } finally {
        setCopiePhoto(false);
      }
    }
    if (!photo) {
      toast.error('Prends d’abord la photo AVANT du problème');
      return;
    }
    demarrer.mutate({ incidentId: incident.id as string, photoAvant: photo }, {
      onSuccess: () => toast.success('Intervention démarrée — chrono lancé'),
      onError: (e) => toast.error(`Démarrage impossible : ${(e as Error).message}`),
    });
  };

  const debutISO = latestIntervention?.debut as string | null ?? null;
  const secondes = useChrono(debutISO);

  const criticite: Criticite = useMemo(() => {
    const code = (priorite?.code as string) ?? '';
    if (code === 'bloquant') return 'bloquant';
    if (code === 'majeur') return 'majeur';
    return 'mineur';
  }, [priorite]);

  const piecesExistantes: PieceUtilisee[] = useMemo(() => {
    if (!latestIntervention) return [];
    const pu = (latestIntervention.pieces_utilisees ?? []) as Record<string, unknown>[];
    return pu.map((p) => {
      const pd = p.pieces_detachees as Record<string, unknown> | null;
      return {
        id: p.id as string,
        nom: (pd?.nom as string) ?? 'Pièce',
        reference: (pd?.reference as string) ?? '',
        // Le stock en base est déjà décrémenté par le trigger à l'enregistrement de la pièce
        stockApres: (pd?.stock_actuel as number) ?? 0,
        quantite: (p.quantite as number) ?? 1,
      };
    });
  }, [latestIntervention]);

  const existingDiagnostic = (latestIntervention?.diagnostic as string) ?? '';
  const existingActions = (latestIntervention?.actions_realisees as string) ?? '';
  const existingPremierCoup = latestIntervention?.resolu_premier_coup as boolean | null ?? null;

  const hasIntervention = !!latestIntervention;
  const currentEtape: Etape = useMemo(() => {
    if (!hasIntervention) return 'diagnostic';
    if (!existingDiagnostic) return 'diagnostic';
    if (!existingActions) return 'actions';
    return 'actions';
  }, [hasIntervention, existingDiagnostic, existingActions]);

  const [etapeActive, setEtapeActive] = useState<Etape>(currentEtape);
  const [diagnostic, setDiagnostic] = useState('');
  // Un diagnostic déjà enregistré s'affiche en lecture jusqu'au clic sur « Modifier »
  const [editionDiagnostic, setEditionDiagnostic] = useState(false);
  const [actions, setActions] = useState('');
  const [premierCoup, setPremierCoup] = useState<boolean | null>(null);
  const [testActivite, setTestActivite] = useState<boolean | null>(null);
  // Plusieurs photos avant / après : la première est obligatoire
  const [photosAvant, setPhotosAvant] = useState<string[]>([]);
  const photoAvant = photosAvant[0] ?? null;
  // Rien ne peut être saisi tant que la photo AVANT n'est pas prise
  const verrouPhoto = !photoAvant && !estResolu;
  // Démarrage possible : photo AVANT prise, ou photo du signalement réutilisée
  const photoDisponible = !!photoAvant || (!!photoSignalement && !autrePhoto);
  // Intervention pas encore démarrée (ou en pause) : seul le bloc « Démarrer » est proposé
  // Directeurs et managers de parc : suivi en lecture seule (pas de démarrage ni de saisie),
  // sauf autorisation « peut intervenir » (tickets de leurs parcs, contrôlé en base)
  const lectureSeule =
    (utilisateur?.role_code === 'manager_parc' || utilisateur?.role_code === 'directeur_parc') && !utilisateur?.peut_intervenir;
  const aDemarrer =
    !lectureSeule && !estResolu && incident?.externe !== true && (!latestIntervention || statutIncident === 'en_pause');
  const formulaireVisible = !lectureSeule && (estResolu || (!aDemarrer && incident?.externe !== true));
  // Détail du problème : le chef d'équipe et les directeurs (sur leurs parcs) le voient tout de suite,
  // les techniciens une fois l'intervention démarrée (ou le ticket clôturé)
  const voirProbleme = utilisateur?.role_code === 'chef_maintenance' || peutValider || estResolu || interventions.length > 0;
  const [photosApres, setPhotosApres] = useState<string[]>([]);
  const photoApres = photosApres[0] ?? null;
  const [dirty, setDirty] = useState(false);
  const [showModale, setShowModale] = useState(false);
  const [showPause, setShowPause] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [piecesAjoutees, setPiecesAjoutees] = useState<PieceAjoutee[]>([]);
  const [showAjoutPiece, setShowAjoutPiece] = useState(false);

  const toast = useToast();
  const draftKey = btNumero ? `cloture:${btNumero}` : null;
  const draft = useDraftPersistence<{
    diagnostic: string;
    actions: string;
    premierCoup: boolean | null;
    testActivite?: boolean | null;
    photoAvant: string | null;
    photoApres: string | null;
    photosAvant?: string[];
    photosApres?: string[];
    piecesAjoutees?: PieceAjoutee[];
  }>(draftKey);

  if (incident && !initialized) {
    // Un brouillon local (saisie non encore envoyée) prime sur les données serveur.
    const d = draft.restore();
    const serveurAvant = (latestIntervention?.photos_avant ?? []) as string[];
    const serveurApres = (latestIntervention?.photos_apres ?? []) as string[];
    setDiagnostic(d?.diagnostic ?? existingDiagnostic);
    setActions(d?.actions ?? existingActions);
    setPremierCoup(d?.premierCoup ?? existingPremierCoup);
    setTestActivite(d?.testActivite ?? ((latestIntervention?.test_activite as boolean | null | undefined) ?? null));
    setEtapeActive(currentEtape);
    setPhotosAvant(d?.photosAvant ?? (d?.photoAvant ? [d.photoAvant] : serveurAvant));
    setPhotosApres(d?.photosApres ?? (d?.photoApres ? [d.photoApres] : serveurApres));
    setPiecesAjoutees(d?.piecesAjoutees ?? []);
    if (d) setDirty(true);
    setInitialized(true);
  }

  // Sauvegarde automatique de la saisie en cours (anti-perte réseau/veille).
  useAutoSaveDraft(
    draft.save,
    { diagnostic, actions, premierCoup, testActivite, photoAvant, photoApres, photosAvant, photosApres, piecesAjoutees },
    initialized && dirty
  );

  const handleBack = useCallback(() => {
    if (dirty) {
      setShowModale(true);
    } else {
      navigate(-1);
    }
  }, [dirty, navigate]);

  const confirmerQuitter = () => {
    setShowModale(false);
    navigate(-1);
  };

  const etapeIndex = etapes.findIndex((e) => e.code === etapeActive);

  const equipLibelle = (equip?.libelle as string) ?? '';
  const equipCode = (equip?.code as string) ?? '';
  const parcNom = (parc?.nom as string) ?? '';
  const zoneName = (zone?.nom as string) ?? '';
  // Titre : activité · pièce en panne (ex. « Trampoline · Trampoline T12 »)
  const activite = ((equip?.categories_equipement as Record<string, unknown> | null)?.activite as string | undefined) ?? null;
  const titre = [activite, equipLibelle || (incident?.titre as string)].filter(Boolean).join(' · ');

  const handleCloturer = async () => {
    setErreur(null);

    if (!diagnostic.trim()) return setErreur('Le diagnostic est obligatoire.');
    if (!photoAvant) return setErreur('La photo AVANT intervention est obligatoire.');
    if (!actions.trim()) return setErreur('Les actions réalisées sont obligatoires.');
    if (!photoApres) return setErreur('La photo APRES réparation est obligatoire.');
    if (premierCoup === null) return setErreur('Indique si le problème a été résolu du 1er coup.');
    if (testActivite === null) return setErreur('Indique si le test de l’activité a été fait (oui ou non).');
    if (!incident?.id) return setErreur('Incident introuvable.');

    const paramsCloture = {
      incidentId: incident.id as string,
      interventionId: (latestIntervention?.id as string) ?? null,
      diagnostic,
      actions,
      resoluPremierCoup: premierCoup,
      testActivite,
      photoAvantUrl: photoAvant,
      photoApresUrl: photoApres,
      photosAvantUrls: photosAvant,
      photosApresUrls: photosApres,
      pieces: piecesAjoutees.map((p) => ({ pieceId: p.pieceId, quantite: p.quantite })),
    };

    try {
      await cloturer.mutateAsync(paramsCloture);

      await exportInterventionPDF({
        numeroBT: btNumero ?? '',
        titre,
        equipementLibelle: equipLibelle,
        equipementCode: equipCode,
        parcNom,
        zoneNom: zoneName,
        criticite,
        diagnostic,
        actions,
        resoluPremierCoup: premierCoup,
        debut: debutISO,
        fin: new Date().toISOString(),
        technicienNom: utilisateur ? `${utilisateur.prenom} ${utilisateur.nom}` : '',
        pieces: [
          ...piecesExistantes.map((p) => ({ nom: p.nom, reference: p.reference, quantite: p.quantite })),
          ...piecesAjoutees.map((p) => ({ nom: p.nom, reference: p.reference, quantite: p.quantite })),
        ],
        photoBucket: 'alba-interventions',
        photoAvantPath: photoAvant,
        photoApresPath: photoApres,
      });

      draft.clear();
      setDirty(false);
      toast.success(`Intervention ${btNumero ?? ''} clôturée — PDF généré.`);
      navigate(-1);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      // Sans réseau : la clôture est gardée sur l'appareil et envoyée automatiquement
      if (estErreurReseau(e) && utilisateur?.id) {
        try {
          await mettreActionEnFile('cloture_intervention', `${btNumero ?? ''} · ${titre}`, {
            params: paramsCloture,
            utilisateurId: utilisateur.id,
          });
          draft.clear();
          setDirty(false);
          toast.info(`Hors connexion : clôture de ${btNumero ?? ''} enregistrée, envoi automatique au retour du réseau.`);
          navigate(-1);
          return;
        } catch {
          // stockage local indisponible : on garde le brouillon et on prévient
        }
      }
      setErreur(
        estErreurReseau(e)
          ? 'Connexion instable — ta saisie est conservée, réessaie dans un instant.'
          : msg || 'Erreur lors de la clôture.'
      );
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-app flex items-center justify-center">
        <div className="text-dim text-sm animate-pulse">Chargement de l'intervention...</div>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="min-h-screen bg-bg-app flex flex-col items-center justify-center gap-3">
        <div className="text-dim text-sm">Incident introuvable : {btNumero}</div>
        <button onClick={() => navigate(-1)} className="text-nikito-cyan text-sm underline">
          Retour
        </button>
      </div>
    );
  }

  return (
    <>
      <TabletHeader
        parc={equipLibelle}
        parcCode="INTERVENTION EN COURS"
        titre={`${btNumero} · ${titre}`}
        showBack
        onBack={handleBack}
        rightSlot={
          debutISO ? (
            <div className="bg-gradient-danger text-text px-3.5 py-2 rounded-xl font-mono text-lg font-bold tracking-wider">
              {formatChrono(secondes)}
            </div>
          ) : undefined
        }
      />

      <div className="bg-bg-deep px-[18px] py-3.5 flex items-center gap-2.5 border-b border-white/[0.04]">
        <CritTag niveau={criticite} />
        <span className="text-[13px] text-dim">
          {equipCode}{zoneName ? ` · ${zoneName}` : ''}{parcNom ? ` · ${parcNom}` : ''}
        </span>
        {debutISO && (
          <span className="ml-auto text-[11px] text-green">
            ● démarré {new Date(debutISO).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <main className="p-4 px-[18px] bg-bg-app flex flex-col gap-3.5">
        <div className="bg-bg-card rounded-xl px-4 py-3 border border-white/[0.06] flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-dim">
            Signalé par <strong className="text-text">{(incident.declare_par_nom as string | null) || 'inconnu'}</strong>
            {incident.declare_le ? ` le ${new Date(incident.declare_le as string).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}` : ''}
          </span>
          {peutValider && !estAnnule && (
            <button
              onClick={() => setSuppression(true)}
              className="ml-auto px-3 rounded-lg text-[12px] font-semibold min-h-[36px] border border-red/40 text-red"
            >
              Supprimer le ticket
            </button>
          )}
        </div>

        {voirProbleme && (
          <ProblemeSignale
            titre={incident.titre as string | null}
            description={incident.description as string | null}
            priorite={(priorite?.nom as string | undefined) ?? null}
            equipement={[equip?.code, equip?.libelle].filter(Boolean).join(' · ') || null}
            categorie={((equip?.categories_equipement as Record<string, unknown> | null)?.nom as string | undefined) ?? null}
            lieu={[zone?.nom, parc?.nom ?? incident.parc_ticket_code].filter(Boolean).join(' · ') || null}
          />
        )}

        {estAnnule && (
          <div className="bg-red/10 border border-red/30 rounded-xl px-4 py-3 text-[13px]">
            <strong className="text-red">Ticket supprimé</strong>
            {incident.supprime_le ? ` le ${new Date(incident.supprime_le as string).toLocaleDateString('fr-FR')}` : ''}
            {incident.supprime_motif ? <div className="text-dim mt-1">Motif : {incident.supprime_motif as string}</div> : null}
          </div>
        )}

        {enAttenteValidation && (
          <div className="bg-amber/10 border border-amber/40 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3">
            <div className="text-[13px] flex-1 min-w-[200px]">
              <strong className="text-amber">En attente de validation</strong>
              <div className="text-dim">Le ticket arrivera dans Opérations une fois validé par le directeur du parc, un manager principal ou le chef d'équipe.</div>
            </div>
            {peutValider && (
              <button
                onClick={() => setRefus(true)}
                className="px-4 rounded-[10px] text-[13px] font-semibold min-h-[44px] bg-bg-card border border-red/40 text-red"
              >
                ✕ Refuser
              </button>
            )}
            {peutValider && (
              <button
                onClick={() =>
                  validerTicket.mutate(incident.id as string, {
                    onSuccess: () => toast.success('Ticket validé : il est dans Opérations'),
                    onError: (e) => toast.error((e as Error).message),
                  })
                }
                disabled={validerTicket.isPending}
                className="px-4 rounded-[10px] text-[13px] font-bold min-h-[44px] bg-gradient-cta text-text disabled:opacity-50"
              >
                ✓ Valider le ticket
              </button>
            )}
          </div>
        )}

        {/* Ticket résolu / fermé : réouverture (chef d'équipe) et historique */}
        {(estResolu || reouvertures.length > 0) && (peutRouvrir || reouvertures.length > 0) && (
          <div className="bg-bg-card border border-white/[0.06] rounded-xl px-4 py-3 flex flex-col gap-2">
            {estResolu && peutRouvrir && (
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-[13px] flex-1 min-w-[200px] text-dim">Ticket clôturé. La panne est revenue ou la réparation est incomplète ?</div>
                <button
                  onClick={() => setReouverture(true)}
                  className="px-4 rounded-[10px] text-[13px] font-bold min-h-[44px] bg-amber/15 text-amber border border-amber/40"
                >
                  ↺ Rouvrir le ticket
                </button>
              </div>
            )}
            {reouvertures.map((r, i) => (
              <div key={i} className="text-[12px] text-dim">
                ↺ Rouvert le {new Date(r.le).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                {r.par_nom ? ` par ${r.par_nom}` : ''} : <span className="text-text">{r.motif}</span>
              </div>
            ))}
          </div>
        )}
        {reouverture && (
          <ModaleRouvrirTicket incidentId={incident.id as string} numeroBT={btNumero ?? ''} onClose={() => setReouverture(false)} />
        )}

        {refus && (
          <ModaleRefuserTicket
            incidentId={incident.id as string}
            numeroBT={btNumero ?? ''}
            onClose={() => setRefus(false)}
            onRefuse={() => navigate(-1)}
          />
        )}

        {suppression && (
          <ModaleSupprimerTicket
            incidentId={incident.id as string}
            numeroBT={btNumero ?? ''}
            onClose={() => setSuppression(false)}
            onSupprime={() => navigate(-1)}
          />
        )}

        {aDemarrer && !enAttenteValidation && !estAnnule && (
          <div className="bg-bg-card rounded-2xl p-5 border-2 border-nikito-cyan shadow-lg flex flex-col gap-4">
            <div className="flex-1">
              <div className="text-[18px] font-bold">
                {statutIncident === 'en_pause' ? 'Intervention en pause' : 'Intervention non démarrée'}
              </div>
              <div className="text-[14px] text-dim mt-1">
                {statutIncident === 'en_pause'
                  ? `Motif : ${(incident.pause_motif as string | null) || 'non précisé'}. Reprends pour relancer le ticket.`
                  : photoSignalement && !autrePhoto
                    ? signalementVideo
                      ? 'La vidéo prise à la création du ticket sert de photo AVANT. Démarre quand tu es prêt.'
                      : 'La photo prise à la création du ticket sert de photo AVANT. Démarre quand tu es prêt.'
                    : 'Étape 1 : photo AVANT du problème. Étape 2 : démarrer (chrono, ticket « en cours »).'}
              </div>
              {/* Problème à traiter : toujours sous les yeux du technicien au moment de démarrer */}
              <div className="mt-3 bg-amber/10 border border-amber/40 rounded-xl px-3.5 py-3">
                <div className="text-[11px] text-amber uppercase tracking-wider mb-1">Problème à traiter</div>
                {incident.titre ? <div className="text-[15px] font-semibold">{incident.titre as string}</div> : null}
                <div className={cn('text-[14px] mt-0.5 whitespace-pre-line', !incident.description && 'text-faint')}>
                  {(incident.description as string | null) || 'Pas de description'}
                </div>
              </div>
              {photoAvant && <div className="text-green text-[14px] font-semibold mt-3">✓ Photo AVANT prise</div>}
              {!photoAvant && photoSignalement && !autrePhoto && (
                <div className="mt-3 flex items-center gap-3">
                  {urlPhotoSignalement && signalementVideo ? (
                    <video src={urlPhotoSignalement} muted playsInline preload="metadata" className="w-20 h-20 rounded-lg object-cover bg-bg-deep" />
                  ) : urlPhotoSignalement ? (
                    <img src={urlPhotoSignalement} alt="Photo du signalement" className="w-20 h-20 rounded-lg object-cover bg-bg-deep" />
                  ) : (
                    <div className="w-20 h-20 rounded-lg bg-bg-deep animate-pulse" />
                  )}
                  <div>
                    <div className="text-green text-[14px] font-semibold">✓ Photo AVANT : {signalementVideo ? 'la vidéo du signalement' : 'celle du signalement'}</div>
                    <button onClick={() => setAutrePhoto(true)} className="text-nikito-cyan text-[13px] underline min-h-[36px]">
                      Prendre une autre photo
                    </button>
                  </div>
                </div>
              )}
              {!photoAvant && (!photoSignalement || autrePhoto) && (
                <div className="mt-3">
                  <PhotoCapture
                    bucketName="alba-interventions"
                    storagePath={`intervention/${btNumero ?? 'draft'}/avant`}
                    onPhotoUploaded={(url) => { setPhotosAvant([url]); setDirty(true); }}
                    required
                    label="📷 Photo AVANT réparation (obligatoire pour démarrer)"
                  />
                </div>
              )}
            </div>
            <button
              onClick={demarrerIntervention}
              disabled={demarrer.isPending || copiePhoto || !photoDisponible}
              className={cn(
                'bg-gradient-cta text-text px-6 py-5 rounded-2xl text-[18px] font-bold min-h-[64px] w-full shadow-lg',
                (demarrer.isPending || copiePhoto || !photoDisponible) && 'opacity-40'
              )}
            >
              {demarrer.isPending || copiePhoto
                ? '…'
                : !photoDisponible
                  ? '📷 Photo AVANT d’abord'
                  : statutIncident === 'en_pause'
                    ? '▶ Reprendre'
                    : '▶ Démarrer l\'intervention'}
            </button>
          </div>
        )}

        <PhotosTicket
          incidentId={incident.id as string}
          chemins={((incident.photos_urls as string[] | null) ?? []).filter(Boolean)}
          dossier={`${(parc?.code as string) ?? 'PARC'}/${btNumero ?? 'ticket'}`}
          modifiable={!estResolu && !lectureSeule}
        />

        {lectureSeule && <SuiviLectureSeule incident={incident as Record<string, unknown>} intervention={latestIntervention} />}

        <NotesPartagees type="ticket" objetId={incident.id as string} />

        {/* Rangements du ticket (sans le fermer) : pièce en attente, intervenant extérieur */}
        {!lectureSeule && incident.externe !== true && <PanneauAttentePiece incident={incident as Record<string, unknown>} />}
        {!lectureSeule && incident.attente_piece !== true && (
          <PanneauIntervenantExterieur incident={incident as Record<string, unknown>} onCloture={() => navigate(-1)} />
        )}

        {/* Le formulaire de réparation n'apparaît qu'une fois l'intervention démarrée */}
        {formulaireVisible && (
          <>
        {/* Stepper */}
        <div>
          <div className="flex justify-between mb-2.5">
            <div className="text-[11px] text-dim uppercase tracking-wider">Étapes</div>
            <div className="text-[11px] text-nikito-cyan">{etapeIndex + 1} / 4</div>
          </div>
          <div className="flex gap-1.5">
            {etapes.map((e, i) => (
              <div
                key={e.code}
                className={cn(
                  'flex-1 h-1.5 rounded-sm',
                  i < etapeIndex ? 'bg-green' : i === etapeIndex ? 'bg-nikito-cyan' : 'bg-[#2A2A5A]'
                )}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[10px]">
            {etapes.map((e, i) => (
              <span
                key={e.code}
                className={cn(
                  i < etapeIndex && 'text-green',
                  i === etapeIndex && 'text-nikito-cyan font-medium',
                  i > etapeIndex && 'text-dim'
                )}
              >
                {i < etapeIndex ? '✓ ' : ''}
                {e.label}
              </span>
            ))}
          </div>
        </div>

        {/* Diagnostic */}
        <div className="bg-bg-card rounded-xl p-3.5 px-4">
          <div className="flex justify-between items-center mb-2.5">
            <div className={cn('text-[13px] font-semibold', diagnostic ? 'text-green' : 'text-nikito-cyan')}>
              {diagnostic ? '✓' : '▸'} Diagnostic
            </div>
            {existingDiagnostic && !editionDiagnostic && (
              <button
                onClick={() => {
                  setEditionDiagnostic(true);
                  setEtapeActive('diagnostic');
                }}
                className="bg-transparent border-none text-nikito-cyan text-[11px]"
              >
                Modifier
              </button>
            )}
          </div>
          {/* Photo AVANT en premier : rien ne peut être saisi sans elle */}
          <div className="mb-3">
            <PhotosMultiples
              bucketName="alba-interventions"
              storagePath={`intervention/${btNumero ?? 'draft'}/avant`}
              chemins={photosAvant}
              onChange={(c) => { setPhotosAvant(c); setDirty(true); }}
              modifiable={!estResolu}
              required
              label="Photo AVANT intervention (avant de toucher à quoi que ce soit)"
            />
          </div>
          {existingDiagnostic && !editionDiagnostic ? (
            <div className="text-[13px] text-text leading-relaxed bg-bg-deep p-3 rounded-lg">{diagnostic}</div>
          ) : (
            <textarea
              value={diagnostic}
              disabled={verrouPhoto}
              onChange={(e) => { setDiagnostic(e.target.value); setDirty(true); }}
              placeholder={photoAvant || estResolu ? 'Décrire le diagnostic...' : '📷 Prends d’abord la photo AVANT ci-dessus'}
              className="w-full bg-bg-deep border border-white/[0.08] rounded-lg text-text p-3 text-[13px] resize-y min-h-[90px] outline-none focus:border-nikito-cyan"
            />
          )}
        </div>

        {/* Tout le reste est verrouillé tant que la photo AVANT n'est pas prise */}
        {verrouPhoto && (
          <div className="bg-amber/10 border border-amber/40 text-amber text-[13px] rounded-xl p-3 text-center font-semibold">
            📷 Prends la photo AVANT (bloc Diagnostic) pour débloquer la saisie
          </div>
        )}
        <fieldset
          disabled={verrouPhoto}
          aria-disabled={verrouPhoto}
          className={cn('contents', verrouPhoto && '[&>*]:opacity-40 [&>*]:pointer-events-none')}
        >
        {/* Pièces */}
        <div className="bg-bg-card rounded-xl p-3.5 px-4">
          <div className="flex justify-between items-center mb-3">
            <div className={cn('text-[13px] font-semibold', piecesExistantes.length + piecesAjoutees.length > 0 ? 'text-green' : 'text-dim')}>
              {piecesExistantes.length + piecesAjoutees.length > 0 ? '✓' : '○'} Pièces utilisées
            </div>
            {saisiePiecesActive && (
              <button
                onClick={() => setShowAjoutPiece(true)}
                className="bg-transparent border border-nikito-cyan text-nikito-cyan px-2.5 py-1 rounded-md text-[11px] min-h-[32px]"
              >
                + Ajouter
              </button>
            )}
          </div>
          {piecesExistantes.length + piecesAjoutees.length > 0 ? (
            <div className="flex flex-col gap-2">
              {piecesAjoutees.map((p) => (
                <div key={p.pieceId} className="bg-bg-deep p-2.5 px-3.5 rounded-lg flex items-center gap-3">
                  <div className="flex-1">
                    <div className="text-[13px] font-medium">{p.nom}</div>
                    <div className="text-[11px] text-dim font-mono">
                      {p.reference}{p.reference ? ' · ' : ''}{p.stock > 0 ? `stock après clôture : ${Math.max(0, p.stock - p.quantite)}` : 'hors stock'}
                    </div>
                  </div>
                  <div className="bg-nikito-cyan/20 text-nikito-cyan px-2.5 py-1 rounded-md text-xs font-semibold">
                    x{p.quantite}
                  </div>
                  <button
                    onClick={() => {
                      setPiecesAjoutees((l) => l.filter((x) => x.pieceId !== p.pieceId));
                      setDirty(true);
                    }}
                    className="text-red text-[11px] px-1 min-h-[32px]"
                    aria-label="Retirer la pièce"
                  >
                    Retirer
                  </button>
                </div>
              ))}
              {piecesExistantes.map((p) => (
                <div key={p.id} className="bg-bg-deep p-2.5 px-3.5 rounded-lg flex items-center gap-3">
                  <div className="flex-1">
                    <div className="text-[13px] font-medium">{p.nom}</div>
                    <div className="text-[11px] text-dim font-mono">
                      {p.reference}{p.reference ? ' · ' : ''}stock après : {p.stockApres}
                    </div>
                  </div>
                  <div className="bg-nikito-cyan/20 text-nikito-cyan px-2.5 py-1 rounded-md text-xs font-semibold">
                    x{p.quantite}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-[12px] text-dim text-center py-4">Aucune pièce ajoutée</div>
          )}
        </div>

        {/* Actions */}
        <div className={cn('bg-bg-card rounded-xl p-3.5 px-4', etapeActive === 'actions' && 'border border-nikito-cyan')}>
          <div className="flex justify-between items-center mb-3">
            <div className="text-[13px] font-semibold text-nikito-cyan">
              ▸ Actions réalisées <span className="text-red text-[11px] ml-1">obligatoire</span>
            </div>
          </div>
          {!photoAvant && !estResolu && (
            <div className="text-amber text-[12px] mb-2">📷 Prends d’abord la photo AVANT du problème (dans « Diagnostic »).</div>
          )}
          <textarea
            value={actions}
            disabled={verrouPhoto}
            onChange={(e) => { setActions(e.target.value); setDirty(true); }}
            placeholder="Décrire les actions réalisées..."
            className="w-full bg-bg-deep border border-white/[0.08] rounded-lg text-text p-3 text-[13px] resize-y min-h-[90px] outline-none focus:border-nikito-cyan"
          />
          <div className="mt-3.5">
            <div className="text-[12px] text-dim mb-1.5">Photos APRÈS réparation</div>
            <PhotosMultiples
              bucketName="alba-interventions"
              storagePath={`intervention/${btNumero ?? 'draft'}/apres`}
              chemins={photosApres}
              onChange={(c) => { setPhotosApres(c); setDirty(true); }}
              modifiable={!estResolu}
              required
              label="Photo APRES reparation"
            />
          </div>
        </div>

        {/* Premier coup */}
        <div className="bg-bg-card rounded-xl p-3.5 px-4">
          <div className="text-[13px] font-semibold mb-3">Résolu du 1er coup ?</div>
          <div className="flex gap-2.5">
            <button
              onClick={() => { setPremierCoup(true); setDirty(true); }}
              className={cn(
                'flex-1 py-3.5 rounded-[10px] text-sm font-bold',
                premierCoup === true
                  ? 'bg-gradient-to-r from-green to-lime text-bg-app'
                  : 'bg-bg-deep border border-white/10 text-text'
              )}
            >
              Oui
            </button>
            <button
              onClick={() => { setPremierCoup(false); setDirty(true); }}
              className={cn(
                'flex-1 py-3.5 rounded-[10px] text-sm',
                premierCoup === false
                  ? 'bg-amber text-bg-app font-bold'
                  : 'bg-bg-deep border border-white/10 text-text'
              )}
            >
              Non
            </button>
          </div>
        </div>

        <ChoixTestActivite
          valeur={testActivite}
          onChange={(v) => { setTestActivite(v); setDirty(true); }}
          desactive={estResolu}
        />

        {erreur && (
          <div className="bg-red/10 border border-red/30 text-red text-[13px] rounded-xl p-3 text-center">
            {erreur}
          </div>
        )}

        <button
          onClick={handleCloturer}
          disabled={cloturer.isPending}
          className="bg-gradient-cta text-text py-4 rounded-2xl text-base font-bold mt-1 disabled:opacity-60"
        >
          {cloturer.isPending ? 'Clôture en cours…' : 'Clôturer · générer PDF'}
        </button>
        </fieldset>

        <button
          onClick={() => setShowPause(true)}
          className="bg-transparent border border-white/10 text-dim py-3 rounded-[10px] text-xs"
        >
          Mettre en pause · sauvegarder brouillon
        </button>
          </>
        )}
      </main>

      <ModaleQuitterSansValider
        open={showModale}
        onConfirmer={confirmerQuitter}
        onAnnuler={() => setShowModale(false)}
      />

      {showAjoutPiece && (
        <ModaleAjouterPiece
          onClose={() => setShowAjoutPiece(false)}
          onAjouter={(piece, quantite) => {
            if (piecesExistantes.some((x) => x.reference === piece.reference)) {
              toast.info('Cette pièce est déjà enregistrée sur cette intervention.');
              return;
            }
            setPiecesAjoutees((l) => {
              const existe = l.find((x) => x.pieceId === piece.id);
              if (existe) return l.map((x) => (x.pieceId === piece.id ? { ...x, quantite: x.quantite + quantite } : x));
              return [...l, { pieceId: piece.id, nom: piece.nom, reference: piece.reference, stock: piece.stock_actuel, quantite }];
            });
            setDirty(true);
            setShowAjoutPiece(false);
          }}
        />
      )}

      {showPause && incident?.id && (
        <ModalePauseTicket
          incidentId={incident.id as string}
          numeroBT={btNumero ?? ''}
          onClose={() => setShowPause(false)}
          onSuccess={() => {
            setShowPause(false);
            navigate(-1);
          }}
        />
      )}
    </>
  );
}

const LIBELLES_STATUT: Record<string, string> = {
  ouvert: 'À faire',
  assigne: 'Assigné à un technicien',
  en_cours: 'Intervention en cours',
  en_pause: 'En pause',
  resolu: 'Résolu',
  ferme: 'Fermé',
  annule: 'Supprimé',
};

const dateHeure = (iso: unknown) =>
  iso ? new Date(iso as string).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : null;

/** Suivi du ticket pour les managers de parc : état et avancement, sans action possible. */
/** Ce qui a été signalé : titre, description, gravité, équipement et lieu. */
function ProblemeSignale({
  titre,
  description,
  priorite,
  equipement,
  categorie,
  lieu,
}: {
  titre: string | null;
  description: string | null;
  priorite: string | null;
  equipement: string | null;
  categorie: string | null;
  lieu: string | null;
}) {
  const lignes: [string, string | null][] = [
    ['Gravité', priorite],
    ['Équipement', equipement ?? 'Saisi à la main (non rattaché)'],
    ['Catégorie', categorie],
    ['Lieu', lieu],
  ];
  return (
    <div className="bg-bg-card rounded-xl px-4 py-3.5 border border-amber/30">
      <div className="text-[11px] text-amber uppercase tracking-wider mb-1.5">Problème signalé</div>
      {titre && <div className="text-[15px] font-semibold">{titre}</div>}
      <div className={cn('text-[14px] mt-1 whitespace-pre-line', !description && 'text-faint')}>{description || 'Pas de description'}</div>
      <div className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12px]">
        {lignes
          .filter(([, v]) => !!v)
          .map(([l, v]) => (
            <div key={l} className="contents">
              <span className="text-dim">{l}</span>
              <span>{v}</span>
            </div>
          ))}
      </div>
    </div>
  );
}

function SuiviLectureSeule({
  incident: i,
  intervention: iv,
}: {
  incident: Record<string, unknown>;
  intervention: Record<string, unknown> | null;
}) {
  const lignes: [string, string | null][] = [
    ['État', LIBELLES_STATUT[i.statut as string] ?? (i.statut as string)],
    ['Intervention démarrée', dateHeure(iv?.debut)],
    ['Terminée', dateHeure(iv?.fin ?? i.resolu_le)],
    ['Motif de la pause', i.statut === 'en_pause' ? ((i.pause_motif as string | null) ?? 'non précisé') : null],
    ['Pièce en attente', i.attente_piece === true ? ((i.attente_piece_detail as string | null) ?? 'oui') : null],
    [
      'Intervenant extérieur',
      i.externe === true
        ? [
            (i.externe_fournisseur as { nom?: string } | null)?.nom ?? (i.externe_nom as string | null) ?? 'oui',
            i.externe_date_prevue ? `prévu le ${new Date(`${i.externe_date_prevue as string}T12:00:00`).toLocaleDateString('fr-FR')}` : null,
          ]
            .filter(Boolean)
            .join(' · ')
        : null,
    ],
    ['Diagnostic', (iv?.diagnostic as string | null) ?? null],
    ['Actions réalisées', (iv?.actions_realisees as string | null) ?? null],
  ];
  return (
    <div className="bg-bg-card rounded-xl p-4 border border-white/[0.06]">
      <div className="text-[11px] text-dim uppercase tracking-wider mb-2">Suivi du ticket</div>
      <div className="grid gap-1.5 text-[13px]">
        {lignes
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <span className="text-dim w-[150px] flex-shrink-0">{k}</span>
              <span className="whitespace-pre-line">{v}</span>
            </div>
          ))}
      </div>
      <div className="text-[11px] text-faint mt-3">Consultation seulement : l'intervention est gérée par l'équipe maintenance.</div>
    </div>
  );
}

/** Extrait une image JPEG d'une vidéo (début du film), pour servir de photo AVANT. */
function imageDepuisVideo(video: Blob): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(video);
    const el = document.createElement('video');
    const echec = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Vidéo du signalement illisible ici : prends une photo AVANT'));
    };
    const minuteur = window.setTimeout(echec, 15000);
    el.muted = true;
    el.playsInline = true;
    el.preload = 'auto';
    el.onerror = () => { window.clearTimeout(minuteur); echec(); };
    el.onloadedmetadata = () => {
      el.currentTime = Math.min(0.5, (el.duration || 1) / 2);
    };
    el.onseeked = () => {
      window.clearTimeout(minuteur);
      const canvas = document.createElement('canvas');
      const echelle = Math.min(1, 1600 / Math.max(el.videoWidth || 1, el.videoHeight || 1));
      canvas.width = Math.round((el.videoWidth || 1) * echelle);
      canvas.height = Math.round((el.videoHeight || 1) * echelle);
      const ctx = canvas.getContext('2d');
      if (!ctx || !el.videoWidth) return echec();
      ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((b) => {
        URL.revokeObjectURL(url);
        if (b) resolve(b);
        else reject(new Error('Vidéo du signalement illisible ici : prends une photo AVANT'));
      }, 'image/jpeg', 0.85);
    };
    el.src = url;
  });
}
