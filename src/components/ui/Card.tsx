import { cn } from '@/lib/utils';
import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  borderLeft?: 'pink' | 'cyan' | 'amber' | 'red' | 'violet';
}

const borderClasses = {
  pink: 'border-l-[3px] border-l-nikito-pink',
  cyan: 'border-l-[3px] border-l-nikito-cyan',
  amber: 'border-l-[3px] border-l-amber',
  red: 'border-l-[3px] border-l-red',
  violet: 'border-l-[3px] border-l-nikito-violet',
};

export function Card({ children, borderLeft, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-bg-card rounded-lg border border-white/[0.07] p-[18px] shadow-[0_14px_34px_rgba(0,0,0,0.16)]',
        borderLeft && borderClasses[borderLeft],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface CardHeadProps {
  titre: string;
  meta?: string;
  metaTone?: 'default' | 'red' | 'amber';
}

export function CardHead({ titre, meta, metaTone = 'default' }: CardHeadProps) {
  const metaClass = {
    default: 'text-dim',
    red: 'text-red font-medium',
    amber: 'text-amber font-medium',
  }[metaTone];
  return (
    <div className="flex justify-between items-start gap-3 mb-3.5">
      <h3 className="text-[13px] font-semibold m-0 leading-snug">{titre}</h3>
      {meta && <span className={cn('text-[11px]', metaClass)}>{meta}</span>}
    </div>
  );
}
