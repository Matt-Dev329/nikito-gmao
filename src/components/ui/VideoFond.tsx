import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

/**
 * Vidéo décorative en boucle, sans son et sans aucun bouton : lecture lancée
 * automatiquement ; si le téléphone la bloque (mode économie d'énergie…),
 * l'image fixe est affichée et la lecture repart au premier toucher d'écran.
 */
export function VideoFond({ src, poster, className, alt = '' }: { src: string; poster: string; className?: string; alt?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [bloquee, setBloquee] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    const lancer = () =>
      v
        .play()
        .then(() => setBloquee(false))
        .catch(() => setBloquee(true));
    void lancer();
    const auToucher = () => void lancer();
    window.addEventListener('pointerdown', auToucher, { passive: true });
    window.addEventListener('touchstart', auToucher, { passive: true });
    document.addEventListener('visibilitychange', auToucher);
    return () => {
      window.removeEventListener('pointerdown', auToucher);
      window.removeEventListener('touchstart', auToucher);
      document.removeEventListener('visibilitychange', auToucher);
    };
  }, [src]);

  return (
    <>
      <video
        ref={ref}
        key={src}
        src={src}
        poster={poster}
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        controls={false}
        tabIndex={-1}
        aria-hidden
        className={cn('video-sans-bouton motion-reduce:hidden', bloquee && 'hidden', className)}
      />
      <img src={poster} alt={alt} className={cn(bloquee ? 'block' : 'hidden motion-reduce:block', className)} />
    </>
  );
}
