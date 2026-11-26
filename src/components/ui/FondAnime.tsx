/**
 * Fond de l'application : logo animé Nikito Maintenance en boucle (sans son),
 * fixé derrière le contenu. Plein écran en largeur ; sur téléphone tenu droit,
 * bandeau centré. Image fixe si les animations sont réduites.
 */
export function FondAnime() {
  return (
    <div aria-hidden className="fixed inset-0 -z-10 pointer-events-none bg-fond-nuit-haut">
      <video
        src="/logo-anime.mp4"
        poster="/logo-anime.jpg"
        autoPlay
        muted
        loop
        playsInline
        className="w-full h-full object-contain landscape:object-cover motion-reduce:hidden"
      />
      <img src="/logo-anime.jpg" alt="" className="w-full h-full object-contain landscape:object-cover hidden motion-reduce:block" />
    </div>
  );
}
