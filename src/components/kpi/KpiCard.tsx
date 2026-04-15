import { cn } from '@/lib/utils';

type Couleur = 'lime' | 'cyan' | 'violet' | 'green' | 'amber' | 'red';

interface KpiCardProps {
  label: string;
  valeur: string | number;
  unite?: string;
  delta?: { texte: string; tone: 'positif' | 'negatif' | 'neutre' };
  couleur: Couleur;
}

const couleurClasses: Record<Couleur, { border: string; text: string }> = {
  lime: { border: 'border-lime', text: 'text-lime' },
  cyan: { border: 'border-nikito-cyan', text: 'text-nikito-cyan' },
  violet: { border: 'border-nikito-violet', text: 'text-nikito-violet' },
  green: { border: 'border-green', text: 'text-green' },
  amber: { border: 'border-amber', text: 'text-amber' },
  red: { border: 'border-red', text: 'text-red' },
};

const deltaTone = {
  positif: 'text-green',
  negatif: 'text-red',
  neutre: 'text-dim',
};

export function KpiCard({ label, valeur, unite, delta, couleur }: KpiCardProps) {
  const c = couleurClasses[couleur];
  return (
    <div className={cn('bg-bg-card rounded-xl p-4 border-t-2', c.border)}>
      <div className="text-[10px] text-dim uppercase tracking-wider mb-2">{label}</div>
      <div className={cn('text-[28px] font-semibold leading-none', c.text)}>
        {valeur}
        {unite && <span className="text-sm text-dim font-normal ml-0.5">{unite}</span>}
      </div>
      {delta && (
        <div className={cn('text-[11px] mt-1', deltaTone[delta.tone])}>{delta.texte}</div>
      )}
    </div>
  );
}
