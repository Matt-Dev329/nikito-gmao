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

function SunriseMark({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-[10px] bg-gradient-to-br from-[#ff4d8b] to-[#5DE5FF] flex items-center justify-center', className)}>
      <svg viewBox="0 0 24 24" fill="none" className="w-[60%] h-[60%]">
        <path d="M12 16a4 4 0 0 0 4-4H8a4 4 0 0 0 4 4Z" fill="#fff" />
        <path d="M3 12h2M19 12h2M12 3v2M5.64 5.64l1.41 1.41M18.36 5.64l-1.41 1.41" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="2" y1="16" x2="22" y2="16" stroke="#fff" strokeWidth="1.2" opacity="0.5" />
      </svg>
    </div>
  );
}

export function Logo({ size = 'md', withText = true, subtitle }: LogoProps) {
  const s = sizes[size];
  return (
    <div className="flex items-center gap-3">
      <SunriseMark className={s.mark} />
      {withText && (
        <div>
          <div className={cn('font-bold tracking-wide', s.text)}>
            <span className="text-[#5DE5FF]">A</span>
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
    <div className="flex flex-col items-center gap-4">
      <div className="relative w-[80px] h-[80px]">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#ff4d8b] to-[#5DE5FF] opacity-25 blur-xl" />
        <div className="relative w-full h-full rounded-full bg-gradient-to-br from-[#ff4d8b] via-[#c76ae8] to-[#5DE5FF] flex items-center justify-center">
          <svg viewBox="0 0 40 40" fill="none" className="w-[50%] h-[50%]">
            <path d="M20 26a8 8 0 0 0 8-8H12a8 8 0 0 0 8 8Z" fill="#fff" />
            <path d="M4 18h3M33 18h3M20 4v3M8.93 8.93l2.12 2.12M31.07 8.93l-2.12 2.12" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
            <line x1="2" y1="26" x2="38" y2="26" stroke="#fff" strokeWidth="1.4" opacity="0.4" />
          </svg>
        </div>
      </div>
      <div className="text-center">
        <div className="text-[40px] font-bold tracking-[0.08em] leading-none">
          <span className="text-[#5DE5FF]">A</span>
          <span className="text-white">LBA</span>
        </div>
        <div className="text-[13px] text-[#8b92b8] mt-1.5 tracking-wide">by Nikito</div>
        <div className="text-[14px] text-[#5DE5FF] italic mt-2">« On protège les familles dès l'aube. »</div>
      </div>
    </div>
  );
}
