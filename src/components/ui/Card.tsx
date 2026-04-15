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
        'bg-bg-card rounded-xl p-[18px]',
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
    <div className="flex justify-between items-center mb-3.5">
      <h3 className="text-[13px] font-medium m-0">{titre}</h3>
      {meta && <span className={cn('text-[11px]', metaClass)}>{meta}</span>}
    </div>
  );
}
