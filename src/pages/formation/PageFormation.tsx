import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useFormation } from '@/hooks/useFormation';
import {
  scenariosStaff,
  scenariosTechnicien,
  scenariosDirection,
  type Scenario,
} from './scenariosData';

const COMPLETED_KEY = 'alba_formation_completed';

function getCompleted(): string[] {
  try {
    return JSON.parse(localStorage.getItem(COMPLETED_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function toggleCompleted(id: string) {
  const current = getCompleted();
  const next = current.includes(id)
    ? current.filter((c) => c !== id)
    : [...current, id];
  localStorage.setItem(COMPLETED_KEY, JSON.stringify(next));
  return next;
}

const groupConfig = [
  {
    key: 'staff' as const,
    label: 'STAFF OPERATIONNEL',
    icon: ClipboardIcon,
    scenarios: scenariosStaff,
    color: 'text-dim',
    border: 'border-faint/30',
  },
  {
    key: 'technicien' as const,
    label: 'TECHNICIEN',
    icon: WrenchIcon,
    scenarios: scenariosTechnicien,
    color: 'text-green',
    border: 'border-green/20',
  },
  {
    key: 'direction' as const,
    label: "DIRECTION / CHEF D'EQUIPE",
    icon: ChartIcon,
    scenarios: scenariosDirection,
    color: 'text-nikito-cyan',
    border: 'border-nikito-cyan/20',
  },
];

export function PageFormation() {
  const { active, enable } = useFormation();
  const navigate = useNavigate();
  const [completed, setCompleted] = useState(getCompleted);

  const handleStart = (s: Scenario) => {
    if (!active) enable();
    navigate(s.lien);
  };

  const handleToggleComplete = (id: string) => {
    setCompleted(toggleCompleted(id));
  };

  const handleReset = () => {
    localStorage.removeItem(COMPLETED_KEY);
    setCompleted([]);
  };

  const totalDone = completed.length;
  const totalAll = scenariosStaff.length + scenariosTechnicien.length + scenariosDirection.length;

  return (
    <div className="p-4 md:p-6 md:px-7 max-w-[900px]">
      <div className="flex flex-col gap-1 mb-6">
        <div className="flex items-center gap-3">
          <GraduationIcon className="w-6 h-6 text-[#7C3AED]" />
          <h1 className="text-xl md:text-[22px] font-semibold">Mode Formation</h1>
        </div>
        <p className="text-[13px] text-dim">
          Entrainez-vous sur des cas pratiques sans affecter les vraies donnees.
          Chaque scenario guide pas a pas.
        </p>
        <div className="flex items-center gap-3 mt-2">
          <div className="text-[12px] text-faint">
            {totalDone} / {totalAll} scenarios termines
          </div>
          <div className="flex-1 h-1.5 bg-bg-deep rounded-full overflow-hidden max-w-[200px]">
            <div
              className="h-full bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] rounded-full transition-all"
              style={{ width: `${totalAll > 0 ? (totalDone / totalAll) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>

      {!active && (
        <div className="bg-[#7C3AED]/10 border border-[#7C3AED]/20 rounded-xl p-4 mb-6 flex items-center gap-4">
          <GraduationIcon className="w-5 h-5 text-[#7C3AED] flex-shrink-0" />
          <div className="flex-1">
            <div className="text-[13px] font-medium">Mode Formation desactive</div>
            <div className="text-[12px] text-dim">
              Le mode sera active automatiquement quand vous lancerez un scenario.
            </div>
          </div>
          <button
            onClick={enable}
            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white px-4 py-2 rounded-lg text-[12px] font-semibold transition-colors flex-shrink-0"
          >
            Activer
          </button>
        </div>
      )}

      <div className="space-y-8">
        {groupConfig.map((group) => (
          <div key={group.key}>
            <div className="flex items-center gap-2 mb-3">
              <group.icon className={cn('w-4 h-4', group.color)} />
              <h2 className={cn('text-[11px] uppercase tracking-[1.4px] font-semibold', group.color)}>
                {group.label}
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {group.scenarios.map((s) => (
                <ScenarioCard
                  key={s.id}
                  scenario={s}
                  done={completed.includes(s.id)}
                  borderColor={group.border}
                  onStart={() => handleStart(s)}
                  onToggleDone={() => handleToggleComplete(s.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 pt-6 border-t border-white/[0.06]">
        <button
          onClick={handleReset}
          className="text-[12px] text-faint hover:text-dim transition-colors underline underline-offset-2"
        >
          Reinitialiser la progression
        </button>
      </div>
    </div>
  );
}

function ScenarioCard({
  scenario,
  done,
  borderColor,
  onStart,
  onToggleDone,
}: {
  scenario: Scenario;
  done: boolean;
  borderColor: string;
  onStart: () => void;
  onToggleDone: () => void;
}) {
  const stars = Array.from({ length: 3 }, (_, i) => i < scenario.difficulte);

  return (
    <div className={cn('bg-bg-card rounded-xl p-4 border', borderColor, done && 'opacity-70')}>
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="text-[14px] font-semibold leading-tight">{scenario.titre}</h3>
        <div className="flex gap-0.5 flex-shrink-0" title={`Difficulte ${scenario.difficulte}/3`}>
          {stars.map((filled, i) => (
            <span key={i} className={cn('text-[11px]', filled ? 'text-amber' : 'text-faint/40')}>
              &#9733;
            </span>
          ))}
        </div>
      </div>
      <p className="text-[12px] text-dim leading-relaxed mb-2.5">{scenario.description}</p>
      <div className="bg-bg-deep rounded-lg px-3 py-2 mb-3">
        <div className="text-[10px] text-faint uppercase tracking-wider mb-0.5">Objectif</div>
        <div className="text-[12px] text-text">{scenario.objectif}</div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={onToggleDone}
          className={cn(
            'text-[11px] px-2.5 py-1.5 rounded-lg border transition-colors',
            done
              ? 'bg-green/15 border-green/30 text-green font-semibold'
              : 'bg-bg-deep border-white/[0.08] text-faint hover:text-dim'
          )}
        >
          {done ? 'Termine' : 'Marquer termine'}
        </button>
        <button
          onClick={onStart}
          className="bg-gradient-to-r from-[#7C3AED] to-[#4F46E5] text-white px-4 py-2 rounded-lg text-[12px] font-semibold hover:brightness-110 transition-all"
        >
          Commencer &#8594;
        </button>
      </div>
    </div>
  );
}

function GraduationIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 2L1 7l9 5 9-5-9-5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M15 9.5v5c0 1.5-2.5 3-5 3s-5-1.5-5-3v-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M18 7v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="2" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M6 2V1.5a1.5 1.5 0 013 0V2" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M5.5 6h5M5.5 8.5h5M5.5 11h3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
  );
}

function WrenchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 2a4 4 0 00-3.87 5.03L2.5 10.67a1.5 1.5 0 002.12 2.12l3.64-3.63A4 4 0 0010 2z" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 13h12M4 9v4M7.5 5.5v7.5M11 7.5V13" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <circle cx="11" cy="3.5" r="2" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  );
}
