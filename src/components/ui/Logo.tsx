import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  withText?: boolean;
  subtitle?: string;
}

const sizes = {
  sm: { mark: 'w-8 h-8', text: 'text-sm' },
  md: { mark: 'w-9 h-9', text: 'text-base' },
  lg: { mark: 'w-14 h-14', text: 'text-2xl' },
};

/** Logo Nikito Maintenance (engrenage + clé) */
function MarqueNikito({ className }: { className?: string }) {
  return <img src="/logo-engrenage.png" alt="Nikito Maintenance" className={cn('rounded-lg object-cover', className)} />;
}

export function Logo({ size = 'md', withText = true, subtitle }: LogoProps) {
  const s = sizes[size];
  return (
    <div className="flex items-center gap-3">
      <MarqueNikito className={s.mark} />
      {withText && (
        <div>
          <div className={cn('font-bold tracking-wide', s.text)}>
            <span className="text-[#45D7F5]">A</span>
            <span className="text-white">LBA</span>
          </div>
          {subtitle && (
            <div className="text-[10px] text-dim tracking-widest uppercase mt-0.5">
              {subtitle}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AlbaLoginHero() {
  return (
    <div className="flex flex-col items-center gap-3">
      <img
        src="/logo-nikito-maintenance.jpg"
        alt="Nikito Maintenance"
        className="w-[240px] max-w-full rounded-2xl"
      />
      <div className="text-center">
        <div className="text-[13px] text-dim tracking-wide">ALBA by Nikito</div>
        <div className="text-[14px] text-nikito-cyan italic mt-1">« On protège les familles dès l'aube. »</div>
      </div>
    </div>
  );
}
