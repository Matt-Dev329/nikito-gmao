import { cn } from '@/lib/utils';
import type { EtatControleItem, TypeControle } from '@/types/database';

// ============================================================
// Composant générique de contrôle · réutilisé pour :
//   - quotidien (staff opérationnel, pré-ouverture)
//   - hebdo (technicien, mode Heijunka)
//   - mensuel (technicien, validation binôme)
//
// Branchement Supabase :
//   - Récupère les points via `bibliotheque_points` filtré par type_controle
//   - Saisie → INSERT dans `controle_items`
//   - Trigger SQL `auto_create_incident` se déclenche sur HS
//   - Validation → UPDATE statut='valide' dans `controles`
// ============================================================

export interface PointControleVue {
  id: string;
  libelle: string;
  ordre: number;
  zone: string;
  bloquantSiKO: boolean;
  photoObligatoire: boolean;
  norme?: string;
  etat: EtatControleItem | null;
  saisiPar?: string; // trigramme agent
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
  onChangerAgent?: () => void;
  onValider?: () => void;
  onRetour?: () => void;
  validationDisabled?: boolean;
  validationDisabledRaison?: string;
}

const typeLabels: Record<TypeControle, string> = {
  quotidien: 'CONTRÔLE OUVERTURE',
  hebdo: 'CONTRÔLE HEBDO',
  mensuel: 'CONTRÔLE MENSUEL',
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
  onChangerAgent,
  onValider,
  onRetour,
  validationDisabled,
  validationDisabledRaison,
}: ControleEcranProps) {
  const totalPoints = zones.reduce((sum, z) => sum + z.count, 0);
  const totalFaits = zones.reduce((sum, z) => sum + z.fait, 0);
  const pctAvancement = totalPoints > 0 ? Math.round((totalFaits / totalPoints) * 100) : 0;

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
      </header>

      {/* Avancement */}
      <ProgressBar
        zones={zones}
        totalFaits={totalFaits}
        totalPoints={totalPoints}
        pctAvancement={pctAvancement}
      />

      {/* Onglets zones */}
      <ZonesTabs zones={zones} active={zoneActiveCode} onChange={onChangeZone} />

      {/* Liste points zone active */}
      <main className="p-3 px-3 md:p-3.5 md:px-[18px] flex flex-col gap-2.5">
        <ZoneCard zoneActive={zones.find((z) => z.code === zoneActiveCode)} points={pointsZoneActive} onSetEtat={onSetEtat} />

        {type === 'quotidien' && (
          <NotePedagogique>
            Si tu pars en pause, le contrôle est sauvegardé. Tes collègues pourront reprendre.
          </NotePedagogique>
        )}

        <button
          onClick={onValider}
          disabled={validationDisabled}
          className={cn(
            'bg-gradient-cta text-text py-4 rounded-2xl text-[15px] font-bold mt-1 min-h-[56px]',
            validationDisabled && 'opacity-50 cursor-not-allowed'
          )}
        >
          Valider le contrôle · signature électronique
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

// ============================================================
// Sous-composants
// ============================================================

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
        <div className="text-xs text-dim">Avancement contrôle</div>
        <div className="text-[13px] font-semibold">
          <span className="text-nikito-cyan">{totalFaits}</span> / {totalPoints} points ·{' '}
          <span className="text-green">{pctAvancement}%</span>
        </div>
      </div>
      <div className="h-2 bg-bg-app rounded-full overflow-hidden flex">
        <div
          className="bg-gradient-to-r from-green to-lime"
          style={{ width: `${pctAvancement}%` }}
        />
      </div>
      <div className="flex justify-between mt-2 text-[10px] text-dim">
        <span>{zones.filter((z) => z.fait === z.count).length} zones terminées</span>
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
              pasCommence && 'bg-bg-card border border-white/[0.08] text-dim'
            )}
          >
            {fait ? '✓ ' : enCours ? '⏵ ' : '○ '}
            {z.label}
            <span
              className={cn(
                'ml-1.5 px-1.5 py-px rounded-lg text-[10px]',
                enCours ? 'bg-white/25' : 'bg-bg-app/30'
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
  onSetEtat,
}: {
  zoneActive?: ZoneVue;
  points: PointControleVue[];
  onSetEtat: (id: string, etat: EtatControleItem) => void;
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
          const isPointActif = i === points.findIndex((pt) => pt.etat === null);
          return (
            <PointRow
              key={p.id}
              point={p}
              actif={isPointActif}
              onSetEtat={(etat) => onSetEtat(p.id, etat)}
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
  onSetEtat,
}: {
  point: PointControleVue;
  actif: boolean;
  onSetEtat: (e: EtatControleItem) => void;
}) {
  const isOK = point.etat === 'ok';
  const isDeg = point.etat === 'degrade';
  const isHS = point.etat === 'hs';
  const aRepondre = point.etat === null;

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 p-2.5 px-3.5 bg-bg-deep rounded-lg',
        isDeg && 'border border-amber',
        actif && aRepondre && 'border-2 border-nikito-cyan p-3'
      )}
    >
      <span
        className={cn(
          'w-[26px] h-[26px] rounded-md flex items-center justify-center font-bold text-sm',
          isOK && 'bg-green text-bg-app',
          isDeg && 'bg-amber text-bg-app',
          isHS && 'bg-red text-bg-app',
          aRepondre && !actif && 'bg-[#2A2A5A] text-dim',
          aRepondre && actif && 'bg-nikito-cyan text-bg-app'
        )}
      >
        {isOK ? '✓' : isDeg ? '!' : isHS ? '×' : actif ? '▸' : '○'}
      </span>

      <div className="flex-1">
        <div className={cn('text-xs', aRepondre && !actif ? 'text-dim' : 'text-text', actif && 'text-[13px] font-semibold')}>
          {point.libelle}
        </div>
        {isDeg && (
          <div className="text-[10px] text-amber mt-0.5">📷 Photo + commentaire requis</div>
        )}
        {actif && point.bloquantSiKO && aRepondre && (
          <div className="text-[10px] text-nikito-cyan mt-0.5">
            ⚠ Bloquant si KO · norme constructeur
          </div>
        )}
      </div>

      {point.saisiPar && (
        <span className="bg-bg-deep text-nikito-cyan px-1.5 py-0.5 rounded text-[10px] font-medium">
          {point.saisiPar}
        </span>
      )}

      {point.etat ? (
        <span
          className={cn(
            'px-2 py-0.5 rounded-md text-[10px] font-bold',
            isOK && 'bg-green text-bg-app',
            isDeg && 'bg-amber text-bg-app',
            isHS && 'bg-red text-bg-app'
          )}
        >
          {isOK ? 'OK' : isDeg ? 'DÉG' : 'HS'}
        </span>
      ) : actif ? (
        <div className="flex gap-1.5">
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
      ) : (
        <div className="flex gap-1">
          <button onClick={() => onSetEtat('ok')} className="bg-transparent border border-white/15 text-dim px-2 py-0.5 rounded-md text-[10px]">OK</button>
          <button onClick={() => onSetEtat('degrade')} className="bg-transparent border border-white/15 text-dim px-2 py-0.5 rounded-md text-[10px]">DÉG</button>
          <button onClick={() => onSetEtat('hs')} className="bg-transparent border border-white/15 text-dim px-2 py-0.5 rounded-md text-[10px]">HS</button>
        </div>
      )}
    </div>
  );
}

function NotePedagogique({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-bg-deep rounded-[10px] p-2.5 px-3.5 flex items-center gap-2.5 text-[11px] text-dim border border-dashed border-nikito-cyan/20">
      <span className="text-amber">ⓘ</span>
      <span>{children}</span>
    </div>
  );
}
