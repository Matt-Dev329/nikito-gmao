import { supabase } from '@/lib/supabase';

/**
 * File d'attente hors-ligne (IndexedDB) — terrain sans réseau.
 *
 * - Photos : si l'envoi d'une photo échoue faute de réseau, l'image est gardée
 *   sur l'appareil avec son chemin définitif ; le formulaire continue avec ce
 *   chemin et la photo part dès le retour du réseau.
 * - Actions : une validation (clôture d'intervention, contrôle, signalement)
 *   qui échoue faute de réseau est gardée puis rejouée automatiquement.
 *   Les photos partent toujours AVANT les actions qui les référencent.
 *
 * Une action refusée par le serveur (erreur métier, pas réseau) reste dans la
 * file avec son message d'erreur, visible dans le bandeau, pour ne rien perdre.
 */

export type TypeAction = 'cloture_intervention' | 'controle_staff' | 'signalement';

export interface PhotoEnAttente {
  id: string;
  bucket: string;
  path: string;
  blob: Blob;
  contentType: string;
  creeLe: string;
}

export interface ActionEnAttente {
  id: string;
  type: TypeAction;
  libelle: string;
  payload: unknown;
  creeLe: string;
  tentatives: number;
  erreur: string | null;
}

type Executeur = (payload: unknown) => Promise<void>;

const DB_NOM = 'alba-hors-ligne';
const DB_VERSION = 1;
const STORE_PHOTOS = 'photos';
const STORE_ACTIONS = 'actions';

const disponible = typeof indexedDB !== 'undefined';
let dbPromise: Promise<IDBDatabase> | null = null;

function ouvrir(): Promise<IDBDatabase> {
  if (!disponible) return Promise.reject(new Error('Stockage hors-ligne indisponible sur cet appareil'));
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NOM, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_PHOTOS)) db.createObjectStore(STORE_PHOTOS, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(STORE_ACTIONS)) db.createObjectStore(STORE_ACTIONS, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => {
        dbPromise = null;
        reject(req.error ?? new Error('Ouverture IndexedDB impossible'));
      };
    });
  }
  return dbPromise;
}

function requete<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return ouvrir().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req.result as T);
        tx.onerror = () => reject(tx.error ?? req.error);
        tx.onabort = () => reject(tx.error ?? new Error('Transaction annulée'));
      })
  );
}

const lister = <T>(store: string) => requete<T[]>(store, 'readonly', (s) => s.getAll());
const enregistrer = (store: string, valeur: unknown) => requete<unknown>(store, 'readwrite', (s) => s.put(valeur));
const supprimer = (store: string, id: string) => requete<unknown>(store, 'readwrite', (s) => s.delete(id));

function nouvelId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** Erreur due au réseau (et non refus du serveur) : on garde et on réessaiera. */
export function estErreurReseau(e: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const msg = e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? e ?? '');
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|network|réseau|timeout|timed out|connexion/i.test(
    msg
  );
}

// --- Abonnement (bandeau, compteurs) -----------------------------------------

export interface EtatFile {
  photos: number;
  actions: ActionEnAttente[];
  synchroEnCours: boolean;
}

let etat: EtatFile = { photos: 0, actions: [], synchroEnCours: false };
const abonnes = new Set<(e: EtatFile) => void>();

export function abonner(fn: (e: EtatFile) => void): () => void {
  abonnes.add(fn);
  fn(etat);
  return () => abonnes.delete(fn);
}

function publier(patch: Partial<EtatFile>) {
  etat = { ...etat, ...patch };
  abonnes.forEach((fn) => fn(etat));
}

export async function rafraichirEtat(): Promise<void> {
  if (!disponible) return;
  try {
    const [photos, actions] = await Promise.all([
      lister<PhotoEnAttente>(STORE_PHOTOS),
      lister<ActionEnAttente>(STORE_ACTIONS),
    ]);
    actions.sort((a, b) => a.creeLe.localeCompare(b.creeLe));
    publier({ photos: photos.length, actions });
  } catch {
    // stockage indisponible (navigation privée…) : rien à afficher
  }
}

// --- Photos ------------------------------------------------------------------

async function envoyerPhoto(bucket: string, path: string, blob: Blob, contentType: string): Promise<void> {
  const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType, upsert: false });
  // Déjà présente (envoi précédent arrivé sans réponse) : c'est bon
  if (error && !/already exists|duplicate/i.test(error.message)) throw error;
}

/**
 * Envoie une photo ; faute de réseau, la garde sur l'appareil (même chemin)
 * pour un envoi automatique plus tard. Renvoie `enAttente: true` dans ce cas.
 */
export async function envoyerPhotoOuMettreEnFile(
  bucket: string,
  path: string,
  blob: Blob,
  contentType = blob.type || 'image/jpeg'
): Promise<{ path: string; enAttente: boolean }> {
  try {
    if (typeof navigator !== 'undefined' && !navigator.onLine) throw new Error('network: hors ligne');
    await envoyerPhoto(bucket, path, blob, contentType);
    return { path, enAttente: false };
  } catch (e) {
    if (!estErreurReseau(e) || !disponible) throw e;
    const photo: PhotoEnAttente = { id: nouvelId(), bucket, path, blob, contentType, creeLe: new Date().toISOString() };
    await enregistrer(STORE_PHOTOS, photo);
    await rafraichirEtat();
    return { path, enAttente: true };
  }
}

// --- Actions -----------------------------------------------------------------

const executeurs = new Map<TypeAction, Executeur>();

/** Déclare comment rejouer un type d'action (fait une fois au démarrage). */
export function declarerExecuteur(type: TypeAction, fn: Executeur): void {
  executeurs.set(type, fn);
}

export async function mettreActionEnFile(type: TypeAction, libelle: string, payload: unknown): Promise<void> {
  const action: ActionEnAttente = {
    id: nouvelId(),
    type,
    libelle,
    payload,
    creeLe: new Date().toISOString(),
    tentatives: 0,
    erreur: null,
  };
  await enregistrer(STORE_ACTIONS, action);
  await rafraichirEtat();
}

export async function abandonnerAction(id: string): Promise<void> {
  await supprimer(STORE_ACTIONS, id);
  await rafraichirEtat();
}

// --- Rejeu -------------------------------------------------------------------

let rejeuEnCours: Promise<void> | null = null;

/** Envoie tout ce qui attend (photos d'abord, puis actions dans l'ordre). */
export function rejouer(): Promise<void> {
  if (!disponible) return Promise.resolve();
  if (rejeuEnCours) return rejeuEnCours;
  rejeuEnCours = (async () => {
    publier({ synchroEnCours: true });
    try {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;

      const photos = await lister<PhotoEnAttente>(STORE_PHOTOS);
      photos.sort((a, b) => a.creeLe.localeCompare(b.creeLe));
      for (const p of photos) {
        try {
          await envoyerPhoto(p.bucket, p.path, p.blob, p.contentType);
          await supprimer(STORE_PHOTOS, p.id);
        } catch (e) {
          if (estErreurReseau(e)) return; // réseau encore instable : on réessaiera
          // Refus définitif (droits, fichier invalide) : on ne bloque pas la file
          console.error('[hors-ligne] photo refusée', p.path, e);
          await supprimer(STORE_PHOTOS, p.id);
        }
      }

      const actions = await lister<ActionEnAttente>(STORE_ACTIONS);
      actions.sort((a, b) => a.creeLe.localeCompare(b.creeLe));
      for (const a of actions) {
        if (a.erreur) continue; // refusée par le serveur : attend une décision de l'utilisateur
        const exec = executeurs.get(a.type);
        if (!exec) continue;
        try {
          await exec(a.payload);
          await supprimer(STORE_ACTIONS, a.id);
        } catch (e) {
          if (estErreurReseau(e)) {
            await enregistrer(STORE_ACTIONS, { ...a, tentatives: a.tentatives + 1 });
            return;
          }
          const msg = e instanceof Error ? e.message : String((e as { message?: unknown })?.message ?? e);
          await enregistrer(STORE_ACTIONS, { ...a, tentatives: a.tentatives + 1, erreur: msg || 'Refusé par le serveur' });
        }
      }
    } finally {
      await rafraichirEtat();
      publier({ synchroEnCours: false });
      rejeuEnCours = null;
    }
  })();
  return rejeuEnCours;
}

/** Réessaie une action refusée (après correction côté serveur, par exemple). */
export async function reessayerAction(id: string): Promise<void> {
  const actions = await lister<ActionEnAttente>(STORE_ACTIONS);
  const a = actions.find((x) => x.id === id);
  if (!a) return;
  await enregistrer(STORE_ACTIONS, { ...a, erreur: null });
  await rejouer();
}
