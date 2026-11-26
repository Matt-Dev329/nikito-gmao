import { useEcranLarge } from '@/hooks/useEcranLarge';

/** Écran de chargement : logo animé Nikito Maintenance plein écran (vertical sur téléphone) */
export function EcranChargement() {
  const large = useEcranLarge();
  const video = large ? '/logo-anime.mp4' : '/logo-anime-tel.mp4';
  const image = large ? '/logo-anime.jpg' : '/logo-anime-tel.jpg';
  return (
    <div className="fixed inset-0 z-[400] bg-fond-nuit-haut">
      <video
        key={video}
        src={video}
        poster={image}
        autoPlay
        muted
        loop
        playsInline
        disablePictureInPicture
        className="w-full h-full object-cover motion-reduce:hidden"
      />
      <img src={image} alt="Nikito Maintenance" className="w-full h-full object-cover hidden motion-reduce:block" />
      <div className="absolute inset-x-0 bottom-[max(env(safe-area-inset-bottom),32px)] text-center text-dim text-sm animate-pulse">
        Chargement…
      </div>
    </div>
  );
}
