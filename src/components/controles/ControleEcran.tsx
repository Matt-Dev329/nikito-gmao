import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { PhotoCapture } from '@/components/shared/PhotoCapture';
import type { EtatControleItem, TypeControle } from '@/types/database';

export interface PointControleVue {
  id: string;
  libelle: string;
  ordre: number;
  zone: string;
  bloquantSiKO: boolean;
  photoObligatoire: boolean;
  norme?: string;
  etat: EtatControleItem | null;
  saisiPar?: string;
  photoUrl?: string;
}

export interface ZoneVue {
  code: string;
  label: string;
  count: number;
  fait: number;
}

interface ControleEcranProps {
  type: TypeControle;
  parcCode: string;
  parcNom: string;
  contexte: string;
  zones: ZoneVue[];
  pointsZoneActive: PointControleVue[];
  zoneActiveCode: string;
  agentActuel: { initiales: string; prenom: string };
  chrono?: string;
  onChangeZone: (code: string) => void;
  onSetEtat: (pointId: string, etat: EtatControleItem) => void;
  onPhotoUploaded?: (pointId: string, url: string) => void;
  bucketName?: string;
  controleId?: string;
  onChangerAgent?: () => void;
  onValider?: () => void;
  onRetour?: () => void;
  validationDisabled?: boolean;
  validationDisabledRaison?: string;
  headerRightSlot?: React.ReactNode;
}

const typeLabels: Record<TypeControle, string> = {
  quotidien: 'CONTROLE OUVERTURE',
  hebdo: 'CONTROLE HEBDO',
  mensuel: 'CONTROLE MENSUEL',
};

export function ControleEcran({
  type,
  parcCode,
  contexte,
  zones,
  pointsZoneActive,
  zoneActiveCode,
  agentActuel,
  chrono,
  onChangeZone,
  onSetEtat,
  onPhotoUploaded,
  bucketName = 'alba-controles',
  controleId,
  onChangerAgent,
  onValider,
  onRetour,
  validationDisabled,
  validationDisabledRaison,
  headerRightSlot,
}: ControleEcranProps) {
  const totalPoints = zones.reduce((sum, z) => sum + z.count, 0);
  const totalFaits = zones.reduce((sum, z) => sum + z.fait, 0);
  const pctAvancement = totalPoints > 0 ? Math.round((totalFaits / totalPoints) * 100) : 0;

  const pointRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const firstNullIdx = pointsZoneActive.findIndex((pt) => pt.etat === null);

  const scrollToPoint = useCallback((pointId: string) => {
    requestAnimationFrame(() => {
      const el = pointRefs.current.get(pointId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }, []);

  const handleSetEtat = useCallback(
    (pointId: string, etat: EtatControleItem) => {
      onSetEtat(pointId, etat);
      const currentIdx = pointsZoneActive.findIndex((p) => p.id === pointId);
      const nextUnfilled = pointsZoneActive.findIndex((p, i) => i > currentIdx && p.etat === null);
      if (nextUnfilled !== -1) {
        scrollToPoint(pointsZoneActive[nextUnfilled].id);
      }
    },
    [onSetEtat, pointsZoneActive, scrollToPoint],
  );

  const registerRef = useCallback((id: string, el: HTMLDivElement | null) => {
    if (el) {
      pointRefs.current.set(id, el);
    } else {
      pointRefs.current.delete(id);
    }
  }, []);

  return (
    <div className="bg-bg-app text-text">
      <header className="px-3 md:px-[18px] py-3 md:py-3.5 bg-bg-sidebar flex items-center gap-2.5 md:gap-3.5 border-b border-white/[0.06]">
        {onRetour && (
          <button
            onClick={onRetour}
            className="bg-bg-card border border-white/[0.08] min-w-[44px] min-h-[44px] md:w-[34px] md:h-[34px] md:min-w-0 md:min-h-0 rounded-[10px] text-base flex-shrink-0 flex items-center justify-center"
          >
            &#8249;
          </button>
        )}
        <div className="w-9 h-9 rounded-[10px] bg-gradient-logo flex items-center justify-center font-bold text-bg-app flex-shrink-0">
          N
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] text-dim tracking-[1.2px]">
            {typeLabels[type]} · {parcCode}
          </div>
          <div className="text-[15px] font-semibold truncate">{contexte}</div>
        </div>
        <AgentPill agent={agentActuel} onChanger={onChangerAgent} />
        {chrono && (
          <div className="bg-gradient-danger text-text px-3 py-1.5 rounded-[14px] font-mono text-[13px] font-bold">
            {chrono}
          </div>
        )}
        {headerRightSlot}
      </header>

      <ProgressBar
        zones={zones}
        totalFaits={totalFaits}
        totalPoints={totalPoints}
        pctAvancement={pctAvancement}
      />

      <ZonesTabs zones={zones} active={zoneActiveCode} onChange={onChangeZone} />

      <main className="p-3 px-3 md:p-3.5 md:px-[18px] flex flex-col gap-2.5">
        <ZoneCard
          zoneActive={zones.find((z) => z.code === zoneActiveCode)}
          points={pointsZoneActive}
          firstNullIdx={firstNullIdx}
          onSetEtat={handleSetEtat}
          registerRef={registerRef}
          onPhotoUploaded={onPhotoUploaded}
          bucketName={bucketName}
          parcCode={parcCode}
          controleId={controleId}
        />

        {type === 'quotidien' && (
          <NotePedagogique>
            Si tu pars en pause, le controle est sauvegarde. Tes collegues pourront reprendre.
          </NotePedagogique>
        )}

        <button
          onClick={onValider}
          disabled={validationDisabled}
          className={cn(
            'bg-gradient-cta text-text py-4 rounded-2xl text-[15px] font-bold mt-1 min-h-[56px]',
            validationDisabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          Valider le controle · signature electronique
          {validationDisabledRaison && (
            <span className="block mt-0.5 text-[11px] font-normal opacity-80">
              {validationDisabledRaison}
            </span>
          )}
        </button>
      </main>
    </div>
  );
}

function AgentPill({
  agent,
  onChanger,
}: {
  agent: { initiales: string; prenom: string };
  onChanger?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-bg-card px-3 py-1.5 rounded-pill">
      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-nikito-pink to-nikito-violet flex items-center justify-center font-bold text-xs text-text">
        {agent.initiales}
      </div>
      <div className="text-xs font-medium">{agent.prenom}</div>
      {onChanger && (
        <button onClick={onChanger} className="text-dim text-[11px] underline ml-1">
          changer
        </button>
      )}
    </div>
  );
}

function ProgressBar({
  zones,
  totalFaits,
  totalPoints,
  pctAvancement,
}: {
  zones: ZoneVue[];
  totalFaits: number;
  totalPoints: number;
  pctAvancement: number;
}) {
  return (
    <div className="bg-bg-deep px-3 md:px-[18px] py-3 md:py-3.5 border-b border-white/[0.04]">
      <div className="flex justify-between mb-2">
        <div className="text-xs text-dim">Avancement controle</div>
        <div className="text-[13px] font-semibold">
          <span className="text-nikito-cyan">{totalFaits}</span> / {totalPoints} points verifies ·{' '}
          <span className="text-green">{pctAvancement}%</span>
        </div>
      </div>
      <div className="h-2.5 bg-bg-app rounded-full overflow-hidden flex">
        <div
          className="bg-gradient-to-r from-green to-lime transition-all duration-500 ease-out"
          style={{ width: `${pctAvancement}%` }}
        />
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-dim">
        <span>{zones.filter((z) => z.fait === z.count).length} zones terminees</span>
        <span>{totalPoints - totalFaits} restants</span>
      </div>
    </div>
  );
}

function ZonesTabs({
  zones,
  active,
  onChange,
}: {
  zones: ZoneVue[];
  active: string;
  onChange: (code: string) => void;
}) {
  return (
    <div className="bg-bg-deep px-3 md:px-[18px] pb-3.5 flex gap-1.5 overflow-x-auto border-b border-white/[0.04]">
      {zones.map((z) => {
        const fait = z.fait === z.count;
        const enCours = active === z.code;
        const pasCommence = z.fait === 0 && !enCours;

        return (
          <button
            key={z.code}
            onClick={() => onChange(z.code)}
            className={cn(
              'px-3.5 py-2.5 md:py-2 rounded-[14px] text-[12px] md:text-[11px] font-semibold whitespace-nowrap min-h-[44px]',
              fait && !enCours && 'bg-green text-bg-app',
              enCours && 'bg-gradient-cta text-text',
              pasCommence && 'bg-bg-card border border-white/[0.08] text-dim',
            )}
          >
            {fait ? '✓ ' : enCours ? '⏵ ' : '○ '}
            {z.label}
            <span
              className={cn(
                'ml-1.5 px-1.5 py-px rounded-lg text-[10px]',
                enCours ? 'bg-white/25' : 'bg-bg-app/30',
              )}
            >
              {z.fait}/{z.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ZoneCard({
  zoneActive,
  points,
  firstNullIdx,
  onSetEtat,
  registerRef,
  onPhotoUploaded,
  bucketName,
  parcCode,
  controleId,
}: {
  zoneActive?: ZoneVue;
  points: PointControleVue[];
  firstNullIdx: number;
  onSetEtat: (id: string, etat: EtatControleItem) => void;
  registerRef: (id: string, el: HTMLDivElement | null) => void;
  onPhotoUploaded?: (pointId: string, url: string) => void;
  bucketName: string;
  parcCode: string;
  controleId?: string;
}) {
  if (!zoneActive) return null;
  const restants = zoneActive.count - zoneActive.fait;

  return (
    <div className="bg-bg-card rounded-xl p-3.5 px-4">
      <div className="flex justify-between items-center mb-1">
        <div className="text-sm font-semibold">Zone {zoneActive.label}</div>
        <span className="bt-num">{zoneActive.count} points</span>
      </div>
      <div className="text-[11px] text-dim mb-3">{restants} points restants · prends ton temps</div>

      <div className="flex flex-col gap-1.5">
        {points.map((p, i) => {
          const isActif = i === firstNullIdx;
          const isVerrouille = p.etat === null && i > firstNullIdx && firstNullIdx !== -1;
          return (
            <PointRow
              key={p.id}
              point={p}
              actif={isActif}
              verrouille={isVerrouille}
              onSetEtat={(etat) => onSetEtat(p.id, etat)}
              registerRef={(el) => registerRef(p.id, el)}
              onPhotoUploaded={onPhotoUploaded ? (url) => onPhotoUploaded(p.id, url) : undefined}
              bucketName={bucketName}
              storagePath={`${parcCode}/${controleId ?? 'draft'}/${p.id}`}
            />
          );
        })}
      </div>
    </div>
  );
}

function PointRow({
  point,
  actif,
  verrouille,
  onSetEtat,
  registerRef,
  onPhotoUploaded,
  bucketName,
  storagePath,
}: {
  point: PointControleVue;
  actif: boolean;
  verrouille: boolean;
  onSetEtat: (e: EtatControleItem) => void;
  registerRef: (el: HTMLDivElement | null) => void;
  onPhotoUploaded?: (url: string) => void;
  bucketName: string;
  storagePath: string;
}) {
  const isOK = point.etat === 'ok';
  const isDeg = point.etat === 'degrade';
  const isHS = point.etat === 'hs';
  const isKO = isDeg || isHS;
  const aRepondre = point.etat === null;
  const [showPhotoOK, setShowPhotoOK] = useState(false);

  const elRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    registerRef(elRef.current);
    return () => registerRef(null);
  }, [registerRef]);

  const needsPhoto = isKO && !point.photoUrl;

  return (
    <div
      ref={elRef}
      className={cn(
        'flex flex-col rounded-lg transition-all duration-200',
        isOK && 'bg-green/[0.06] border border-green/20',
        isDeg && 'bg-amber/[0.06] border border-amber/30',
        isHS && 'bg-red/[0.06] border border-red/30',
        actif && aRepondre && 'bg-nikito-cyan/[0.04] border-2 border-nikito-cyan animate-pulse-subtle',
        verrouille && 'bg-bg-deep opacity-40 cursor-not-allowed',
        !isOK && !isDeg && !isHS && !actif && !verrouille && 'bg-bg-deep',
      )}
    >
      <div className="flex items-center gap-2.5 p-2.5 px-3.5">
        <span
          className={cn(
            'w-[26px] h-[26px] rounded-md flex items-center justify-center font-bold text-sm flex-shrink-0',
            isOK && 'bg-green text-bg-app',
            isDeg && 'bg-amber text-bg-app',
            isHS && 'bg-red text-bg-app',
            actif && aRepondre && 'bg-nikito-cyan text-bg-app',
            verrouille && 'bg-[#2A2A5A] text-faint',
            !isOK && !isDeg && !isHS && !actif && !verrouille && aRepondre && 'bg-[#2A2A5A] text-dim',
          )}
        >
          {isOK ? '✓' : isDeg ? '!' : isHS ? '×' : verrouille ? '🔒' : actif ? '▸' : '○'}
        </span>

        <div className="flex-1 min-w-0">
          <div
            className={cn(
              'text-xs',
              isOK && 'text-text',
              isDeg && 'text-text',
              isHS && 'text-text',
              actif && aRepondre && 'text-[13px] font-semibold text-text',
              verrouille && 'text-faint',
              !isOK && !isDeg && !isHS && !actif && !verrouille && aRepondre && 'text-dim',
            )}
          >
            {point.libelle}
          </div>
          {needsPhoto && (
            <div className={cn('text-[10px] mt-0.5', isDeg ? 'text-amber' : 'text-red')}>
              Photo obligatoire
            </div>
          )}
          {isKO && point.photoUrl && (
            <div className={cn('text-[10px] mt-0.5', isDeg ? 'text-amber' : 'text-red')}>
              Photo jointe
            </div>
          )}
          {actif && point.bloquantSiKO && aRepondre && (
            <div className="text-[10px] text-nikito-cyan mt-0.5">
              Bloquant si KO · norme constructeur
            </div>
          )}
        </div>

        {point.saisiPar && (
          <span className="bg-bg-deep text-nikito-cyan px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0">
            {point.saisiPar}
          </span>
        )}

        {point.etat ? (
          <span
            className={cn(
              'px-2 py-0.5 rounded-md text-[10px] font-bold flex-shrink-0',
              isOK && 'bg-green text-bg-app',
              isDeg && 'bg-amber text-bg-app',
              isHS && 'bg-red text-bg-app',
            )}
          >
            {isOK ? 'OK' : isDeg ? 'DEG' : 'HS'}
          </span>
        ) : actif ? (
          <div className="flex gap-1.5 flex-shrink-0">
            <button
              onClick={() => onSetEtat('ok')}
              className="bg-green text-bg-app px-4 py-2 rounded-lg text-[13px] font-bold min-h-[44px] min-w-[48px]"
            >
              OK
            </button>
            <button
              onClick={() => onSetEtat('degrade')}
              className="bg-transparent border border-amber text-amber px-3 py-2 rounded-lg text-xs font-semibold min-h-[44px] min-w-[48px]"
            >
              DEG
            </button>
            <button
              onClick={() => onSetEtat('hs')}
              className="bg-transparent border border-red text-red px-3 py-2 rounded-lg text-xs font-semibold min-h-[44px] min-w-[48px]"
            >
              HS
            </button>
          </div>
        ) : null}
      </div>

      {isKO && onPhotoUploaded && (
        <div className="px-3.5 pb-3">
          <PhotoCapture
            bucketName={bucketName}
            storagePath={storagePath}
            onPhotoUploaded={onPhotoUploaded}
            required
            existingUrl={point.photoUrl}
          />
        </div>
      )}

      {isOK && onPhotoUploaded && !point.photoUrl && !showPhotoOK && (
        <div className="px-3.5 pb-2">
          <button
            onClick={() => setShowPhotoOK(true)}
            className="text-[11px] text-dim hover:text-nikito-cyan"
          >
            &#128247; Ajouter une photo
          </button>
        </div>
      )}

      {isOK && onPhotoUploaded && (showPhotoOK || point.photoUrl) && (
        <div className="px-3.5 pb-3">
          <PhotoCapture
            bucketName={bucketName}
            storagePath={storagePath}
            onPhotoUploaded={onPhotoUploaded}
            existingUrl={point.photoUrl}
          />
        </div>
      )}
    </div>
  );
}

function NotePedagogique({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-bg-deep rounded-[10px] p-2.5 px-3.5 flex items-center gap-2.5 text-[11px] text-dim border border-dashed border-nikito-cyan/20">
      <span className="text-amber">i</span>
      <span>{children}</span>
    </div>
  );
}
