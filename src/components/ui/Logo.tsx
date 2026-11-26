import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  withText?: boolean;
  subtitle?: string;
  /** Logo complet NIKITO | MAINTENANCE (net, fond transparent) à la place de l'icône */
  anime?: boolean;
}

const sizes = {
  sm: { mark: 'w-8 h-8', bandeau: 'w-[150px]' },
  md: { mark: 'w-9 h-9', bandeau: 'w-[200px]' },
  lg: { mark: 'w-14 h-14', bandeau: 'w-[260px]' },
};

/** Logo animé Nikito Maintenance (en boucle, sans son ; image fixe si animations réduites) */
export function LogoAnime({ className }: { className?: string }) {
  return (
    <video
      src="/logo-anime-petit.mp4"
      poster="/logo-anime.jpg"
      autoPlay
      muted
      loop
      playsInline
      disablePictureInPicture
      controlsList="nodownload nofullscreen noremoteplayback"
      aria-label="Nikito Maintenance"
      className={cn('rounded-lg aspect-video object-cover bg-fond-nuit-haut motion-reduce:hidden', className)}
    />
  );
}

/** Logo de l'application : perceuse Nikito Maintenance */
function MarqueNikito({ className }: { className?: string }) {
  return <img src="/logo-perceuse.png" alt="Nikito Maintenance" className={cn('rounded-lg object-cover', className)} />;
}

export function Logo({ size = 'md', withText = true, subtitle, anime = false }: LogoProps) {
  const s = sizes[size];
  if (anime) {
    return (
      <div className="flex flex-col gap-1.5">
        {/* Menu (avec sous-titre) : logo sur deux lignes ; en-têtes : logo sur une ligne */}
        <img
          src={subtitle && size !== 'sm' ? '/logo-bandeau.png' : '/logo-bandeau-ligne.png'}
          alt="Nikito Maintenance"
          className={cn('h-auto select-none', subtitle && size !== 'sm' ? 'w-[190px]' : s.bandeau)}
          draggable={false}
        />
        {subtitle && <div className="text-[10px] text-dim tracking-widest uppercase">{subtitle}</div>}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3">
      <MarqueNikito className={s.mark} />
      {withText && (
        <div>
          <div className="font-bold tracking-wide text-base">
            <span className="text-nikito-cyan">A</span>
            <span className="text-text">LBA</span>
          </div>
          {subtitle && <div className="text-[10px] text-dim tracking-widest uppercase mt-0.5">{subtitle}</div>}
        </div>
      )}
    </div>
  );
}

export function AlbaLoginHero() {
  return (
    <div className="flex flex-col items-center gap-3">
      <LogoAnime className="w-[300px] max-w-full rounded-2xl" />
      <img src="/logo-anime.jpg" alt="Nikito Maintenance" className="w-[300px] max-w-full rounded-2xl hidden motion-reduce:block" />
      <div className="text-center">
        <div className="text-[13px] text-dim tracking-wide">ALBA by Nikito</div>
        <div className="text-[14px] text-nikito-cyan italic mt-1">« On protège les familles dès l'aube. »</div>
      </div>
    </div>
  );
}
