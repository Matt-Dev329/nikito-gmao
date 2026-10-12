/// <reference types="vite-plugin-pwa/client" />
import { registerSW } from 'virtual:pwa-register';

/**
 * Mises à jour de l'application installée (écran d'accueil / tablette).
 *
 * L'appli installée ne se recharge jamais d'elle-même : sans ce module, une
 * nouvelle version téléchargée en arrière-plan n'était utilisée qu'après avoir
 * complètement fermé l'appli. On vérifie donc la présence d'une nouvelle
 * version au retour dans l'appli, toutes les 30 minutes et à la demande
 * (tirer pour rafraîchir, bouton « Actualiser ») ; en mode autoUpdate la page
 * se recharge dès que la nouvelle version est prête (les saisies en cours
 * sont gardées en brouillon).
 */

let registration: ServiceWorkerRegistration | undefined;

export function initialiserMisesAJour(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  registerSW({
    immediate: true,
    onRegisteredSW(_url, reg) {
      registration = reg;
      if (!reg) return;
      window.setInterval(() => {
        if (navigator.onLine) reg.update().catch(() => undefined);
      }, 30 * 60 * 1000);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && navigator.onLine) reg.update().catch(() => undefined);
      });
    },
  });
}

/** Demande au navigateur de vérifier s'il existe une nouvelle version. */
export async function verifierMiseAJour(): Promise<void> {
  if (!registration || !navigator.onLine) return;
  try {
    await registration.update();
  } catch {
    // réseau instable : on réessaiera
  }
}

/**
 * Attend que la nouvelle version en cours d'installation soit active
 * (au plus `delaiMs`). Sans cette attente, le rechargement repartait sur
 * l'ancienne version encore en cache.
 */
function attendreNouvelleVersion(delaiMs: number): Promise<void> {
  const nouvelle = registration?.installing ?? registration?.waiting;
  if (!nouvelle) return Promise.resolve();
  return new Promise((resolve) => {
    const fin = window.setTimeout(resolve, delaiMs);
    const terminer = () => {
      window.clearTimeout(fin);
      resolve();
    };
    navigator.serviceWorker.addEventListener('controllerchange', terminer, { once: true });
    nouvelle.addEventListener('statechange', () => {
      if (nouvelle.state === 'activated' || nouvelle.state === 'redundant') terminer();
    });
  });
}

/** Vérifie la version, attend qu'elle soit installée, puis recharge complètement l'appli. */
export async function actualiserApplication(): Promise<void> {
  await verifierMiseAJour();
  await attendreNouvelleVersion(15000);
  window.location.reload();
}
