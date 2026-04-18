import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TabletHeader } from '@/components/layout/TabletHeader';
import { CritTag } from '@/components/ui/CritTag';
import { PhotoCapture } from '@/components/shared/PhotoCapture';
import { ModaleQuitterSansValider } from '@/components/ui/ModaleQuitterSansValider';
import { useChrono } from '@/hooks/useChrono';
import { formatChrono, cn } from '@/lib/utils';

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

const piecesMock: PieceUtilisee[] = [
  { id: '1', nom: 'Carte mère Submarine v3', reference: 'SUB-CM-V3', stockApres: 1, quantite: 1 },
  { id: '2', nom: 'Pâte thermique', reference: 'THERM-G2', stockApres: 8, quantite: 1 },
];

export function Intervention() {
  const { btNumero } = useParams();
  const navigate = useNavigate();
  const [debutISO] = useState('2026-04-15T14:09:00.000Z');
  const secondes = useChrono(debutISO);

  const [etapeActive, setEtapeActive] = useState<Etape>('actions');
  const [diagnostic] = useState(
    'Carte mère HS suite à coupure secteur. Pas de signal au démarrage, voyant alim éteint malgré secteur OK testé multimètre.'
  );
  const [actions, setActions] = useState(
    'Démontage capot arrière, remplacement carte mère, application pâte thermique sur dissipateur CPU, test boot OK, test cycle complet ride OK.'
  );
  const [premierCoup, setPremierCoup] = useState<boolean | null>(true);
  const [photoAvant, setPhotoAvant] = useState<string | null>(null);
  const [photoApres, setPhotoApres] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [showModale, setShowModale] = useState(false);

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

  return (
    <>
      <TabletHeader
        parc="Submarine"
        parcCode="INTERVENTION EN COURS"
        titre={`${btNumero} · Submarine`}
        showBack
        onBack={handleBack}
        rightSlot={
          <div className="bg-gradient-danger text-text px-3.5 py-2 rounded-xl font-mono text-lg font-bold tracking-wider">
            ⏱ {formatChrono(secondes)}
          </div>
        }
      />

      <div className="bg-bg-deep px-[18px] py-3.5 flex items-center gap-2.5 border-b border-white/[0.04]">
        <CritTag niveau="bloquant" />
        <span className="text-[13px] text-dim">DOM-ATR-SUB-01 · zone Attractions</span>
        <span className="ml-auto text-[11px] text-green">● démarré 14:09</span>
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

        {/* Diagnostic (étape validée) */}
        <div className="bg-bg-card rounded-xl p-3.5 px-4">
          <div className="flex justify-between items-center mb-2.5">
            <div className="text-[13px] font-semibold text-green">&#10003; Diagnostic</div>
            <button onClick={() => setEtapeActive('diagnostic')} className="bg-transparent border-none text-nikito-cyan text-[11px]">
              Modifier
            </button>
          </div>
          <div className="text-[13px] text-text leading-relaxed bg-bg-deep p-3 rounded-lg">{diagnostic}</div>
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

        {/* Pièces (étape validée) */}
        <div className="bg-bg-card rounded-xl p-3.5 px-4">
          <div className="flex justify-between items-center mb-3">
            <div className="text-[13px] font-semibold text-green">✓ Pièces utilisées</div>
            <button className="bg-transparent border border-nikito-cyan text-nikito-cyan px-2.5 py-1 rounded-md text-[11px]">
              + Ajouter
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {piecesMock.map((p) => (
              <div key={p.id} className="bg-bg-deep p-2.5 px-3.5 rounded-lg flex items-center gap-3">
                <div className="flex-1">
                  <div className="text-[13px] font-medium">{p.nom}</div>
                  <div className="text-[11px] text-dim font-mono">
                    {p.reference} · stock après : {p.stockApres}
                  </div>
                </div>
                <div className="bg-nikito-violet text-bg-app px-2.5 py-1 rounded-md text-xs font-semibold">
                  ×{p.quantite}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions (étape active) */}
        <div className="bg-bg-card rounded-xl p-3.5 px-4 border border-nikito-cyan">
          <div className="flex justify-between items-center mb-3">
            <div className="text-[13px] font-semibold text-nikito-cyan">
              ▸ Actions réalisées <span className="text-red text-[11px] ml-1">obligatoire</span>
            </div>
          </div>
          <textarea
            value={actions}
            onChange={(e) => { setActions(e.target.value); setDirty(true); }}
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
              ✓ Oui
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
              Non · à revoir
            </button>
          </div>
        </div>

        <button className="bg-gradient-cta text-text py-4 rounded-2xl text-base font-bold mt-1">
          Clôturer · générer PDF
        </button>

        <button className="bg-transparent border border-white/10 text-dim py-3 rounded-[10px] text-xs">
          Mettre en pause · sauvegarder brouillon
        </button>
      </main>

      <ModaleQuitterSansValider
        open={showModale}
        onConfirmer={confirmerQuitter}
        onAnnuler={() => setShowModale(false)}
      />
    </>
  );
}
