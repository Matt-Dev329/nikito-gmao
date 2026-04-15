import { cn } from '@/lib/utils';
import type { Criticite } from '@/types/database';

interface CritTagProps {
  niveau: Criticite | 'priorite_1' | 'priorite_2' | 'priorite_3';
  className?: string;
  minWidth?: boolean;
}

const styles: Record<string, { bg: string; label: string }> = {
  bloquant: { bg: 'bg-red', label: 'BLOQUANT' },
  majeur: { bg: 'bg-amber', label: 'MAJEUR' },
  mineur: { bg: 'bg-nikito-cyan', label: 'MINEUR' },
  priorite_1: { bg: 'bg-red', label: 'PRIORITÉ 1' },
  priorite_2: { bg: 'bg-amber', label: 'PRIORITÉ 2' },
  priorite_3: { bg: 'bg-amber', label: 'PRIORITÉ 3' },
};

export function CritTag({ niveau, className, minWidth }: CritTagProps) {
  const s = styles[niveau];
  return (
    <span
      className={cn(
        s.bg,
        'text-bg-app px-2.5 py-0.5 rounded-md text-[11px] font-bold tracking-wide text-center',
        minWidth && 'min-w-[54px]',
        className
      )}
    >
      {s.label}
    </span>
  );
}
