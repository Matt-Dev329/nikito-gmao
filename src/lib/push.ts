import { supabase } from '@/lib/supabase';

/** Clé publique VAPID (la clé privée est dans Vault, côté serveur). */
const VAPID_PUBLIC =
  'BFo_nYNpJ1QWeCndYm1grpRSKXg5f43aUGcWdSxQLmXzcScZ-3mpGWaHpWYH0pHlTak0ELy-ICUf_jAXCWb5wbk';

export type EtatPush = 'non_supporte' | 'installer_appli' | 'refuse' | 'inactif' | 'actif';

function base64UrlVersUint8(base64: string): Uint8Array {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const brut = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(brut, (c) => c.charCodeAt(0));
}

function estIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function estAppliInstallee(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

async function abonnementActuel(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

export async function etatPush(): Promise<EtatPush> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    // Sur iPhone / iPad, les notifications ne marchent qu'une fois l'appli ajoutée à l'écran d'accueil
    return estIOS() && !estAppliInstallee() ? 'installer_appli' : 'non_supporte';
  }
  if (Notification.permission === 'denied') return 'refuse';
  const abo = await abonnementActuel();
  return abo ? 'actif' : 'inactif';
}

/** Demande l'autorisation, abonne l'appareil et l'enregistre pour l'utilisateur connecté. */
export async function activerPush(): Promise<void> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications refusées dans le navigateur');
  const reg = await navigator.serviceWorker.ready;
  const abo =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64UrlVersUint8(VAPID_PUBLIC) as BufferSource,
    }));
  const json = abo.toJSON();
  const { error } = await supabase.rpc('enregistrer_abonnement_push', {
    p_endpoint: abo.endpoint,
    p_p256dh: json.keys?.p256dh ?? '',
    p_auth: json.keys?.auth ?? '',
    p_user_agent: navigator.userAgent.slice(0, 200),
  });
  if (error) throw error;
}

export async function desactiverPush(): Promise<void> {
  const abo = await abonnementActuel();
  if (!abo) return;
  await supabase.rpc('desactiver_abonnement_push', { p_endpoint: abo.endpoint });
  await abo.unsubscribe();
}

/**
 * L'appareil est abonné : on le rattache à l'utilisateur connecté (tablette
 * partagée, changement de compte). Sans effet si l'appareil n'est pas abonné.
 */
export async function rattacherAbonnementPush(): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const abo = await abonnementActuel();
  if (!abo) return;
  const json = abo.toJSON();
  await supabase.rpc('enregistrer_abonnement_push', {
    p_endpoint: abo.endpoint,
    p_p256dh: json.keys?.p256dh ?? '',
    p_auth: json.keys?.auth ?? '',
    p_user_agent: navigator.userAgent.slice(0, 200),
  });
}
