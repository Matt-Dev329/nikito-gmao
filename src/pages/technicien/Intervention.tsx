import { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TabletHeader } from '@/components/layout/TabletHeader';
import { CritTag } from '@/components/ui/CritTag';
import { PhotoCapture } from '@/components/shared/PhotoCapture';
import { ModaleQuitterSansValider } from '@/components/ui/ModaleQuitterSansValider';
import { ModalePauseTicket } from '@/components/tickets/ModalePauseTicket';
import { useChrono } from '@/hooks/useChrono';
import { useIncident } from '@/hooks/queries/useTickets';
import { useCloturerIntervention } from '@/hooks/mutations';
import { useAuth } from '@/hooks/useAuth';
import { exportInterventionPDF } from './exportInterventionPDF';
import { formatChrono, cn } from '@/lib/utils';
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

export function Intervention() {
  const { btNumero } = useParams();
  const navigate = useNavigate();
  const { utilisateur } = useAuth();
  const cloturer = useCloturerIntervention();

  const { data: incident, isLoading } = useIncident(btNumero);

  const equip = incident?.equipements as Record<string, unknown> | null;
  const priorite = incident?.niveaux_priorite as Record<string, unknown> | null;
  const zone = equip?.zones as Record<string, unknown> | null;
  const parc = equip?.parcs as Record<string, unknown> | null;
  const interventions = (incident?.interventions ?? []) as Record<string, unknown>[];

  const latestIntervention = useMemo(() => {
    if (!interventions.length) return null;
    return interventions.sort((a, b) => {
      const da = new Date(a.cree_le as string).getTime();
      const db = new Date(b.cree_le as string).getTime();
      return db - da;
    })[0];
  }, [interventions]);

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
        stockApres: ((pd?.stock_actuel as number) ?? 0) - ((p.quantite as number) ?? 1),
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
  const [actions, setActions] = useState('');
  const [premierCoup, setPremierCoup] = useState<boolean | null>(null);
  const [photoAvant, setPhotoAvant] = useState<string | null>(null);
  const [photoApres, setPhotoApres] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [showModale, setShowModale] = useState(false);
  const [showPause, setShowPause] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  if (incident && !initialized) {
    setDiagnostic(existingDiagnostic);
    setActions(existingActions);
    setPremierCoup(existingPremierCoup);
    setEtapeActive(currentEtape);
    const photosAvant = (latestIntervention?.photos_avant ?? []) as string[];
    const photosApres = (latestIntervention?.photos_apres ?? []) as string[];
    if (photosAvant[0]) setPhotoAvant(photosAvant[0]);
    if (photosApres[0]) setPhotoApres(photosApres[0]);
    setInitialized(true);
  }

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
  const titre = incident?.titre as string ?? equipLibelle;

  const handleCloturer = async () => {
    setErreur(null);

    if (!diagnostic.trim()) return setErreur('Le diagnostic est obligatoire.');
    if (!photoAvant) return setErreur('La photo AVANT intervention est obligatoire.');
    if (!actions.trim()) return setErreur('Les actions réalisées sont obligatoires.');
    if (!photoApres) return setErreur('La photo APRES réparation est obligatoire.');
    if (premierCoup === null) return setErreur('Indique si le problème a été résolu du 1er coup.');
    if (!incident?.id) return setErreur('Incident introuvable.');

    try {
      await cloturer.mutateAsync({
        incidentId: incident.id as string,
        interventionId: (latestIntervention?.id as string) ?? null,
        diagnostic,
        actions,
        resoluPremierCoup: premierCoup,
        photoAvantUrl: photoAvant,
        photoApresUrl: photoApres,
      });

      exportInterventionPDF({
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
        pieces: piecesExistantes.map((p) => ({ nom: p.nom, reference: p.reference, quantite: p.quantite })),
        photoAvantUrl: photoAvant,
        photoApresUrl: photoApres,
      });

      setDirty(false);
      navigate(-1);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Erreur lors de la clôture.');
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
            {diagnostic && (
              <button onClick={() => setEtapeActive('diagnostic')} className="bg-transparent border-none text-nikito-cyan text-[11px]">
                Modifier
              </button>
            )}
          </div>
          {diagnostic ? (
            <div className="text-[13px] text-text leading-relaxed bg-bg-deep p-3 rounded-lg">{diagnostic}</div>
          ) : (
            <textarea
              value={diagnostic}
              onChange={(e) => { setDiagnostic(e.target.value); setDirty(true); }}
              placeholder="Décrire le diagnostic..."
              className="w-full bg-bg-deep border border-white/[0.08] rounded-lg text-text p-3 text-[13px] resize-y min-h-[90px] outline-none focus:border-nikito-cyan"
            />
          )}
          <div className="mt-3">
            <PhotoCapture
              bucketName="alba-interventions"
              storagePath={`intervention/${btNumero ?? 'draft'}/avant`}
              onPhotoUploaded={(url) => { setPhotoAvant(url); setDirty(true); }}
              required
              label="Photo AVANT intervention"
              existingUrl={photoAvant ?? undefined}
            />
          </div>
        </div>

        {/* Pièces */}
        <div className="bg-bg-card rounded-xl p-3.5 px-4">
          <div className="flex justify-between items-center mb-3">
            <div className={cn('text-[13px] font-semibold', piecesExistantes.length > 0 ? 'text-green' : 'text-dim')}>
              {piecesExistantes.length > 0 ? '✓' : '○'} Pièces utilisées
            </div>
            <button className="bg-transparent border border-nikito-cyan text-nikito-cyan px-2.5 py-1 rounded-md text-[11px]">
              + Ajouter
            </button>
          </div>
          {piecesExistantes.length > 0 ? (
            <div className="flex flex-col gap-2">
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
          <textarea
            value={actions}
            onChange={(e) => { setActions(e.target.value); setDirty(true); }}
            placeholder="Décrire les actions réalisées..."
            className="w-full bg-bg-deep border border-white/[0.08] rounded-lg text-text p-3 text-[13px] resize-y min-h-[90px] outline-none focus:border-nikito-cyan"
          />
          <div className="mt-3.5">
            <PhotoCapture
              bucketName="alba-interventions"
              storagePath={`intervention/${btNumero ?? 'draft'}/apres`}
              onPhotoUploaded={(url) => { setPhotoApres(url); setDirty(true); }}
              required
              label="Photo APRES reparation"
              existingUrl={photoApres ?? undefined}
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

        <button
          onClick={() => setShowPause(true)}
          className="bg-transparent border border-white/10 text-dim py-3 rounded-[10px] text-xs"
        >
          Mettre en pause · sauvegarder brouillon
        </button>
      </main>

      <ModaleQuitterSansValider
        open={showModale}
        onConfirmer={confirmerQuitter}
        onAnnuler={() => setShowModale(false)}
      />

      {showPause && incident?.id && (
        <ModalePauseTicket
          incidentId={incident.id as string}
          numeroBT={btNumero ?? ''}
          onClose={() => {
            setShowPause(false);
            navigate(-1);
          }}
        />
      )}
    </>
  );
}
