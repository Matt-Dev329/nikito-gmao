import { useEcranLarge } from '@/hooks/useEcranLarge';
import { VideoFond } from '@/components/ui/VideoFond';

/**
 * Fond de l'application : logo animé Nikito Maintenance en boucle (sans son),
 * fixé derrière le contenu. Version verticale sur téléphone, horizontale sur
 * écran large (ordinateur, tablette en largeur).
 */
export function FondAnime() {
  const large = useEcranLarge();
  return (
    <div aria-hidden className="fixed inset-0 -z-10 pointer-events-none bg-fond-nuit-haut">
      <VideoFond
        src={large ? '/logo-anime.mp4' : '/logo-anime-tel.mp4'}
        poster={large ? '/logo-anime.jpg' : '/logo-anime-tel.jpg'}
        className="w-full h-full object-cover"
      />
    </div>
  );
}
