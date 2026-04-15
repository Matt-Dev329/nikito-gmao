import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  withText?: boolean;
  subtitle?: string;
}

const sizes = {
  sm: { mark: 'w-8 h-8 text-sm rounded-lg', text: 'text-sm' },
  md: { mark: 'w-9 h-9 text-base rounded-[10px]', text: 'text-base' },
  lg: { mark: 'w-14 h-14 text-2xl rounded-2xl', text: 'text-2xl' },
};

export function Logo({ size = 'md', withText = true, subtitle }: LogoProps) {
  const s = sizes[size];
  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'bg-gradient-logo flex items-center justify-center font-bold text-bg-app',
          s.mark
        )}
      >
        N
      </div>
      {withText && (
        <div>
          <div className={cn('font-semibold text-gradient-logo tracking-wide', s.text)}>
            NIKITO
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
