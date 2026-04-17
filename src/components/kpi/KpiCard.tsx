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

const couleurClasses: Record<Couleur, { border: string; text: string }> = {
  lime: { border: 'border-l-lime', text: 'text-lime' },
  cyan: { border: 'border-l-nikito-cyan', text: 'text-nikito-cyan' },
  violet: { border: 'border-l-nikito-violet', text: 'text-nikito-violet' },
  green: { border: 'border-l-green', text: 'text-green' },
  amber: { border: 'border-l-amber', text: 'text-amber' },
  red: { border: 'border-l-red', text: 'text-red' },
};

const deltaTone = {
  positif: 'text-green',
  negatif: 'text-red',
  neutre: 'text-dim',
};

export function KpiCard({ label, valeur, unite, delta, couleur, compact = false }: KpiCardProps) {
  const c = couleurClasses[couleur];
  return (
    <div className={cn('bg-bg-card rounded-xl border-l-[3px]', c.border, compact ? 'p-4' : 'p-6')}>
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
