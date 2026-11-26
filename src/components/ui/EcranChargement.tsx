/**
 * Écran de chargement Nikito Maintenance (fourgon-fusée sur fond étoilé) :
 * version verticale sur téléphone, horizontale sur ordinateur et tablette en largeur.
 */
export function EcranChargement() {
  return (
    <div className="fixed inset-0 z-[400] bg-fond-nuit-haut bg-cover bg-center bg-no-repeat bg-[url('/chargement-portrait.webp')] landscape:bg-[url('/chargement-paysage.webp')] flex items-end justify-center pb-[max(env(safe-area-inset-bottom),32px)]">
      <div className="text-dim text-sm animate-pulse">Chargement…</div>
    </div>
  );
}
