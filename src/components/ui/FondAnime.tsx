import { useEcranLarge } from '@/hooks/useEcranLarge';

/**
 * Fond de l'application : logo animé Nikito Maintenance en boucle (sans son),
 * fixé derrière le contenu. Version verticale sur téléphone, horizontale sur
 * écran large (ordinateur, tablette en largeur). Image fixe si animations réduites.
 */
export function FondAnime() {
  const large = useEcranLarge();
  const video = large ? '/logo-anime.mp4' : '/logo-anime-tel.mp4';
  const image = large ? '/logo-anime.jpg' : '/logo-anime-tel.jpg';
  return (
    <div aria-hidden className="fixed inset-0 -z-10 pointer-events-none bg-fond-nuit-haut">
      <video
        key={video}
        src={video}
        poster={image}
        autoPlay
        muted
        loop
        playsInline
        disablePictureInPicture
        tabIndex={-1}
        className="w-full h-full object-cover motion-reduce:hidden"
      />
      <img src={image} alt="" className="w-full h-full object-cover hidden motion-reduce:block" />
    </div>
  );
}
