import { cn } from '@/lib/utils';

type Couleur = 'lime' | 'cyan' | 'violet' | 'green' | 'amber' | 'red';

interface KpiCardProps {
  label: string;
  valeur: string | number;
  unite?: string;
  delta?: { texte: string; tone: 'positif' | 'negatif' | 'neutre' };
  couleur: Couleur;
  compact?: boolean;
}

const couleurClasses: Record<Couleur, { border: string; text: string; wash: string }> = {
  lime: { border: 'border-l-lime', text: 'text-lime', wash: 'from-lime/[0.12]' },
  cyan: { border: 'border-l-nikito-cyan', text: 'text-nikito-cyan', wash: 'from-nikito-cyan/[0.12]' },
  violet: { border: 'border-l-nikito-violet', text: 'text-nikito-violet', wash: 'from-nikito-violet/[0.12]' },
  green: { border: 'border-l-green', text: 'text-green', wash: 'from-green/[0.12]' },
  amber: { border: 'border-l-amber', text: 'text-amber', wash: 'from-amber/[0.12]' },
  red: { border: 'border-l-red', text: 'text-red', wash: 'from-red/[0.12]' },
};

const deltaTone = {
  positif: 'text-green',
  negatif: 'text-red',
  neutre: 'text-dim',
};

export function KpiCard({ label, valeur, unite, delta, couleur, compact = false }: KpiCardProps) {
  const c = couleurClasses[couleur];
  return (
    <div
      className={cn(
        'relative overflow-hidden bg-bg-card rounded-lg border border-white/[0.07] border-l-[3px] shadow-[0_14px_34px_rgba(0,0,0,0.16)]',
        'before:absolute before:inset-0 before:bg-gradient-to-br before:to-transparent before:pointer-events-none',
        c.border,
        c.wash,
        compact ? 'p-4' : 'p-6'
      )}
    >
      <div className={cn('text-dim uppercase tracking-wider', compact ? 'text-[10px] mb-1.5' : 'text-[11px] mb-2')}>{label}</div>
      <div className={cn('font-semibold leading-none', c.text, compact ? 'text-[22px]' : 'text-[28px]')}>
        {valeur}
        {unite && <span className={cn('text-dim font-normal ml-0.5', compact ? 'text-xs' : 'text-sm')}>{unite}</span>}
      </div>
      {delta && (
        <div className={cn('text-[11px] mt-1', deltaTone[delta.tone])}>{delta.texte}</div>
      )}
    </div>
  );
}
