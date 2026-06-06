import { useOnlineStatus } from '@/hooks/useOnlineStatus';

/**
 * Bandeau global affiché quand l'appareil est hors-ligne.
 * Prévient l'utilisateur que ses saisies sont conservées localement et
 * seront à renvoyer dès le retour du réseau.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div
      role="status"
      className="fixed top-0 inset-x-0 z-[100] bg-amber text-bg-app text-[13px] font-semibold text-center py-1.5 px-3"
    >
      Hors connexion — tes saisies sont conservées sur l'appareil et seront à valider au retour du réseau.
    </div>
  );
}
