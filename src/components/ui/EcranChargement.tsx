import { LogoAnime } from '@/components/ui/Logo';

/** Écran de chargement : logo animé Nikito Maintenance */
export function EcranChargement() {
  return (
    <div className="fixed inset-0 z-[400] bg-fond-nuit-haut flex flex-col items-center justify-center gap-4 px-4">
      <LogoAnime className="w-[min(92vw,720px)] rounded-2xl" />
      <img src="/logo-anime.jpg" alt="Nikito Maintenance" className="w-[min(92vw,720px)] rounded-2xl hidden motion-reduce:block" />
      <div className="text-dim text-sm animate-pulse">Chargement…</div>
    </div>
  );
}
