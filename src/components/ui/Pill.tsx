import { cn } from '@/lib/utils';
import type { ButtonHTMLAttributes } from 'react';

interface PillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  variant?: 'outline' | 'cyan' | 'gradient';
}

export function Pill({ active, variant = 'outline', className, children, ...props }: PillProps) {
  const base = 'px-3.5 py-1.5 rounded-pill text-xs transition-colors whitespace-nowrap';

  const variants = {
    outline: active
      ? 'bg-bg-card border border-nikito-cyan text-nikito-cyan font-medium'
      : 'bg-bg-card border border-white/[0.06] text-dim hover:border-white/20',
    cyan: active
      ? 'bg-nikito-cyan text-bg-app border-none font-semibold'
      : 'bg-transparent border border-white/10 text-dim',
    gradient: active
      ? 'bg-gradient-cta text-text border-none font-medium'
      : 'bg-bg-card border border-white/[0.06] text-text',
  };

  return (
    <button className={cn(base, variants[variant], className)} {...props}>
      {children}
    </button>
  );
}
