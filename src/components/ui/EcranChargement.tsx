import { useEcranLarge } from '@/hooks/useEcranLarge';
import { VideoFond } from '@/components/ui/VideoFond';

/** Écran de chargement : logo animé Nikito Maintenance plein écran (vertical sur téléphone) */
export function EcranChargement() {
  const large = useEcranLarge();
  return (
    <div className="fixed inset-0 z-[400] bg-fond-nuit-haut">
      <VideoFond
        src={large ? '/logo-anime.mp4' : '/logo-anime-tel.mp4'}
        poster={large ? '/logo-anime.jpg' : '/logo-anime-tel.jpg'}
        alt="Nikito Maintenance"
        className="w-full h-full object-cover"
      />
      <div className="absolute inset-x-0 bottom-[max(env(safe-area-inset-bottom),32px)] text-center text-dim text-sm animate-pulse">
        Chargement…
      </div>
    </div>
  );
}
