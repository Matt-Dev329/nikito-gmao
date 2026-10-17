import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { useViewAs } from '@/hooks/useViewAs';
import { roleLabels } from '@/lib/tokens';
import { useParcs } from '@/hooks/queries/useReferentiel';
import type { RoleUtilisateur } from '@/types/database';

interface RoleSimulable {
  code: RoleUtilisateur;
  label: string;
  needsParc: boolean;
  /** Manager principal (badge MGR) */
  principal?: boolean;
}

const simulableRoles: RoleSimulable[] = [
  { code: 'chef_maintenance', label: "Chef d'equipe", needsParc: false },
  { code: 'directeur_parc', label: 'Directeur de parc', needsParc: true },
  { code: 'technicien', label: 'Technicien', needsParc: false },
  { code: 'manager_parc', label: 'Manager principal (MGR)', needsParc: true, principal: true },
  { code: 'manager_parc', label: 'Manager Parc', needsParc: true },
  { code: 'staff_operationnel', label: 'Staff operationnel', needsParc: true },
  { code: 'admin_it', label: 'Admin IT', needsParc: false },
];

interface ViewAsSelectorProps {
  compact?: boolean;
}

export function ViewAsSelector({ compact = false }: ViewAsSelectorProps) {
  const { role, principal, activate, reset } = useViewAs();
  const activeRole = role;
  const actif = simulableRoles.find((r) => r.code === role && !!r.principal === principal) ?? null;
  const [open, setOpen] = useState(false);
  const [parcPickerFor, setParcPickerFor] = useState<RoleSimulable | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const { data: parcs } = useParcs();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setParcPickerFor(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (r: RoleSimulable) => {
    if (r.needsParc) {
      setParcPickerFor(r);
      return;
    }
    activate(r.code);
    setOpen(false);
    setParcPickerFor(null);
  };

  const handleSelectParc = (parcId: string, parcLabel: string) => {
    if (!parcPickerFor) return;
    activate(parcPickerFor.code, parcId, parcLabel, null, !!parcPickerFor.principal);
    setOpen(false);
    setParcPickerFor(null);
  };

  const handleReset = () => {
    reset();
    setOpen(false);
    setParcPickerFor(null);
  };

  if (compact) {
    return (
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            'w-9 h-9 rounded-lg flex items-center justify-center transition-colors',
            activeRole
              ? 'bg-amber/20 text-amber'
              : 'bg-white/[0.04] text-dim hover:text-text'
          )}
          title="Voir comme..."
        >
          <EyeIcon className="w-[18px] h-[18px]" />
        </button>
        {open && (
          <DropdownPanel
            activeRole={activeRole}
            actif={actif}
            parcPickerFor={parcPickerFor}
            parcs={parcs ?? []}
            onSelect={handleSelect}
            onSelectParc={handleSelectParc}
            onReset={handleReset}
            onBack={() => setParcPickerFor(null)}
            position="left"
          />
        )}
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-2 rounded-[10px] px-3 py-2 text-[12px] transition-colors w-full min-h-[40px]',
          activeRole
            ? 'bg-amber/15 text-amber font-medium'
            : 'text-dim hover:text-text hover:bg-white/[0.04]'
        )}
      >
        <EyeIcon className="w-[18px] h-[18px] flex-shrink-0" />
        <span className="truncate">
          {actif ? `Vue : ${actif.label}` : activeRole ? `Vue : ${roleLabels[activeRole]}` : 'Voir comme...'}
        </span>
        <ChevronIcon className={cn('w-3.5 h-3.5 ml-auto flex-shrink-0 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <DropdownPanel
          activeRole={activeRole}
          actif={actif}
          parcPickerFor={parcPickerFor}
          parcs={parcs ?? []}
          onSelect={handleSelect}
          onSelectParc={handleSelectParc}
          onReset={handleReset}
          onBack={() => setParcPickerFor(null)}
          position="bottom"
        />
      )}
    </div>
  );
}

function DropdownPanel({
  activeRole,
  actif,
  parcPickerFor,
  parcs,
  onSelect,
  onSelectParc,
  onReset,
  onBack,
  position,
}: {
  activeRole: RoleUtilisateur | null;
  actif: RoleSimulable | null;
  parcPickerFor: RoleSimulable | null;
  parcs: { id: string; code: string; nom: string }[];
  onSelect: (r: RoleSimulable) => void;
  onSelectParc: (parcId: string, parcLabel: string) => void;
  onReset: () => void;
  onBack: () => void;
  position: 'left' | 'bottom';
}) {
  const posClass =
    position === 'left'
      ? 'absolute left-full top-0 ml-2'
      : 'absolute left-0 right-0 bottom-full mb-1';

  if (parcPickerFor) {
    const roleLabel = parcPickerFor.label;
    return (
      <div className={cn(posClass, 'z-50 bg-bg-card border border-white/[0.08] rounded-xl shadow-xl py-1.5 min-w-[200px]')}>
        <button
          onClick={onBack}
          className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-dim hover:text-text hover:bg-white/[0.04] transition-colors"
        >
          <span className="text-[10px]">&#8592;</span>
          <span>{roleLabel}</span>
        </button>
        <div className="h-px bg-white/[0.06] mx-2 my-1" />
        <div className="px-2.5 py-1.5 text-[10px] text-faint uppercase tracking-wider">
          Choisir un parc
        </div>
        {parcs.map((p) => (
          <button
            key={p.id}
            onClick={() => onSelectParc(p.id, `${p.code} - ${p.nom}`)}
            className="flex items-center gap-2 w-full px-3 py-2 text-[12px] text-dim hover:text-text hover:bg-white/[0.04] transition-colors"
          >
            <span className="text-[10px] font-bold bg-bg-deep border border-white/[0.06] px-1.5 py-0.5 rounded">
              {p.code}
            </span>
            <span className="truncate">{p.nom}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn(posClass, 'z-50 bg-bg-card border border-white/[0.08] rounded-xl shadow-xl py-1.5 min-w-[200px]')}>
      <button
        onClick={onReset}
        className={cn(
          'flex items-center gap-2 w-full px-3 py-2 text-[12px] transition-colors',
          !activeRole ? 'text-nikito-cyan font-medium' : 'text-dim hover:text-text hover:bg-white/[0.04]'
        )}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-nikito-cyan flex-shrink-0" style={{ opacity: !activeRole ? 1 : 0 }} />
        Ma vue (Direction)
      </button>
      <div className="h-px bg-white/[0.06] mx-2 my-1" />
      {simulableRoles.map((r) => (
        <button
          key={r.label}
          onClick={() => onSelect(r)}
          className={cn(
            'flex items-center gap-2 w-full px-3 py-2 text-[12px] transition-colors',
            actif === r ? 'text-amber font-medium' : 'text-dim hover:text-text hover:bg-white/[0.04]'
          )}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-amber flex-shrink-0" style={{ opacity: actif === r ? 1 : 0 }} />
          Voir comme : {r.label}
          {r.needsParc && <span className="ml-auto text-faint text-[10px]">&#8250;</span>}
        </button>
      ))}
    </div>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 4.5C5.5 4.5 2 10 2 10s3.5 5.5 8 5.5 8-5.5 8-5.5-3.5-5.5-8-5.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
