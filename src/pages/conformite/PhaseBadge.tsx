import { cn } from '@/lib/utils';

const PHASE_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  projet: { label: 'Projet', bg: 'bg-white/10', text: 'text-dim' },
  etudes: { label: 'Etudes', bg: 'bg-blue-500/15', text: 'text-blue-400' },
  pre_commission: { label: 'Pre-commission', bg: 'bg-nikito-cyan/15', text: 'text-nikito-cyan' },
  travaux: { label: 'Travaux', bg: 'bg-amber/15', text: 'text-amber' },
  commission_initiale: { label: 'Commission initiale', bg: 'bg-yellow-500/15', text: 'text-yellow-400' },
  reserves_a_lever: { label: 'Reserves a lever', bg: 'bg-red/15', text: 'text-red' },
  ouverture: { label: 'Ouverture', bg: 'bg-green/15', text: 'text-green' },
  vie_courante: { label: 'Vie courante', bg: 'bg-green/20', text: 'text-green' },
  travaux_modif: { label: 'Travaux modif.', bg: 'bg-orange-600/15', text: 'text-orange-400' },
  ferme: { label: 'Ferme', bg: 'bg-white/5', text: 'text-faint' },
};

export function PhaseBadge({ phase, size = 'sm' }: { phase: string; size?: 'sm' | 'md' }) {
  const config = PHASE_CONFIG[phase] ?? { label: phase, bg: 'bg-white/10', text: 'text-dim' };
  return (
    <span className={cn(
      'inline-flex items-center rounded-md font-medium',
      config.bg, config.text,
      size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : 'text-[11px] px-2 py-1'
    )}>
      {config.label}
    </span>
  );
}

export const PHASES_ORDERED = [
  'projet', 'etudes', 'pre_commission', 'travaux',
  'commission_initiale', 'reserves_a_lever',
  'ouverture', 'vie_courante', 'travaux_modif', 'ferme',
] as const;

export { PHASE_CONFIG };
