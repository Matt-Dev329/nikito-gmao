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

/**
 * Version publiée (version.json, jamais mis en cache) comparée à celle qui
 * tourne : si une nouvelle version est en ligne, l'appli se met à jour seule
 * — tout de suite au retour sur l'appli, sinon dès que l'écran n'a pas été
 * touché depuis 2 minutes (pour ne pas recharger en pleine saisie ; les
 * saisies en cours sont de toute façon gardées en brouillon).
 */
let nouvelleVersionEnLigne = false;
let derniereActivite = Date.now();
const CLE_TENTATIVE = 'alba:maj_tentee';

async function nouvelleVersionPubliee(): Promise<boolean> {
  if (!navigator.onLine || typeof __ALBA_BUILD__ === 'undefined') return false;
  try {
    const r = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) return false;
    const { build } = (await r.json()) as { build?: string };
    return !!build && build !== __ALBA_BUILD__;
  } catch {
    return false;
  }
}

async function appliquerSiNouvelleVersion(immediat: boolean): Promise<void> {
  if (!nouvelleVersionEnLigne) nouvelleVersionEnLigne = await nouvelleVersionPubliee();
  if (!nouvelleVersionEnLigne) return;
  const inactif = Date.now() - derniereActivite > 2 * 60 * 1000;
  if (!immediat && !inactif) return;
  // Garde-fou : une seule tentative toutes les 10 minutes (évite une boucle de rechargements)
  try {
    const derniere = Number(sessionStorage.getItem(CLE_TENTATIVE) ?? 0);
    if (Date.now() - derniere < 10 * 60 * 1000) return;
    sessionStorage.setItem(CLE_TENTATIVE, String(Date.now()));
  } catch {
    // stockage indisponible : on tente quand même
  }
  await actualiserApplication();
}

function surveillerNouvelleVersion(): void {
  for (const evt of ['pointerdown', 'keydown', 'touchstart']) {
    window.addEventListener(evt, () => (derniereActivite = Date.now()), { passive: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void appliquerSiNouvelleVersion(true);
  });
  window.setInterval(() => void appliquerSiNouvelleVersion(false), 5 * 60 * 1000);
  void appliquerSiNouvelleVersion(false);
}

export function initialiserMisesAJour(): void {
  if (typeof window === 'undefined') return;
  surveillerNouvelleVersion();
  if (!('serviceWorker' in navigator)) return;
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
