import { cn } from '@/lib/utils';
import type { ButtonHTMLAttributes } from 'react';

interface PillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  variant?: 'outline' | 'cyan' | 'gradient';
}

export function Pill({ active, variant = 'outline', className, children, ...props }: PillProps) {
  const base = 'px-3.5 py-2 rounded-lg text-xs transition-all whitespace-nowrap border min-h-[36px]';

  const variants = {
    outline: active
      ? 'bg-nikito-cyan/12 border-nikito-cyan/45 text-nikito-cyan font-semibold shadow-[0_0_0_1px_rgba(69,215,245,0.12)]'
      : 'bg-bg-card border-white/[0.07] text-dim hover:text-text hover:border-white/20 hover:bg-white/[0.04]',
    cyan: active
      ? 'bg-nikito-cyan text-bg-app border-nikito-cyan font-semibold'
      : 'bg-transparent border-white/10 text-dim hover:text-text',
    gradient: active
      ? 'bg-gradient-cta text-text border-transparent font-semibold'
      : 'bg-bg-card border-white/[0.07] text-text hover:bg-white/[0.04]',
  };

  return (
    <button className={cn(base, variants[variant], className)} {...props}>
      {children}
    </button>
  );
}
