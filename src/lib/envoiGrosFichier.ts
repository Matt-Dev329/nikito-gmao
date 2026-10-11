import { Upload } from 'tus-js-client';
import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabase';

/** Au-delà de cette taille, l'envoi se fait par morceaux (reprenable). */
const SEUIL_MORCEAUX = 6 * 1024 * 1024;

/**
 * Envoie un fichier dans un bucket Supabase. Les fichiers lourds (> 6 Mo)
 * partent par morceaux de 6 Mo (protocole TUS) : la coupure réseau ne fait
 * pas tout recommencer, et la progression est remontée.
 */
export async function envoyerFichier(
  bucket: string,
  chemin: string,
  fichier: File,
  onProgression?: (pourcentage: number) => void,
): Promise<void> {
  const contentType = fichier.type || 'application/octet-stream';

  if (fichier.size <= SEUIL_MORCEAUX) {
    const { error } = await supabase.storage.from(bucket).upload(chemin, fichier, { contentType });
    if (error) throw error;
    onProgression?.(100);
    return;
  }

  const { data } = await supabase.auth.getSession();
  const jeton = data.session?.access_token;
  if (!jeton) throw new Error('Session expirée : reconnecte-toi puis réessaie');

  await new Promise<void>((resolve, reject) => {
    const envoi = new Upload(fichier, {
      endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: { authorization: `Bearer ${jeton}`, apikey: supabaseAnonKey, 'x-upsert': 'false' },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      chunkSize: SEUIL_MORCEAUX,
      metadata: { bucketName: bucket, objectName: chemin, contentType, cacheControl: '3600' },
      onError: (e) =>
        reject(
          new Error(
            /\b413\b|Maximum size exceeded/i.test(e.message)
              ? `Fichier trop lourd pour le serveur (${(fichier.size / 1024 / 1024).toFixed(0)} Mo) : la limite d'envoi du projet doit être relevée (Supabase → Storage → Settings).`
              : `Envoi interrompu : ${e.message}`,
          ),
        ),
      onProgress: (envoye, total) => onProgression?.(Math.round((envoye / total) * 100)),
      onSuccess: () => resolve(),
    });
    envoi.findPreviousUploads().then((precedents) => {
      if (precedents.length) envoi.resumeFromPreviousUpload(precedents[0]);
      envoi.start();
    }, reject);
  });
}

/**
 * Taille d'une partie pour les documents découpés : sous la limite d'envoi
 * globale du projet (50 Mo), qui s'applique à chaque fichier stocké.
 */
export const TAILLE_PARTIE = 40 * 1024 * 1024;

export function cheminPartie(chemin: string, index: number): string {
  return `${chemin}.part${String(index + 1).padStart(3, '0')}`;
}

/**
 * Envoie un document, découpé en parties de 40 Mo s'il est plus lourd.
 * Renvoie le nombre de parties (null si le fichier est stocké en un seul
 * morceau à `chemin`).
 */
export async function envoyerDocument(
  bucket: string,
  chemin: string,
  fichier: File,
  onProgression?: (pourcentage: number) => void,
): Promise<number | null> {
  if (fichier.size <= TAILLE_PARTIE) {
    await envoyerFichier(bucket, chemin, fichier, onProgression);
    return null;
  }
  const parties = Math.ceil(fichier.size / TAILLE_PARTIE);
  const contentType = fichier.type || 'application/octet-stream';
  for (let i = 0; i < parties; i++) {
    const debut = i * TAILLE_PARTIE;
    const morceau = new File([fichier.slice(debut, debut + TAILLE_PARTIE)], fichier.name, { type: contentType });
    await envoyerFichier(bucket, cheminPartie(chemin, i), morceau, (p) =>
      onProgression?.(Math.round(((debut + (morceau.size * p) / 100) / fichier.size) * 100)),
    );
  }
  return parties;
}

/** Télécharge les parties d'un document découpé et les recolle en un seul fichier. */
export async function recollerDocument(
  bucket: string,
  chemin: string,
  parties: number,
  mime: string | null,
  onProgression?: (pourcentage: number) => void,
): Promise<Blob> {
  const morceaux: Blob[] = [];
  for (let i = 0; i < parties; i++) {
    const { data, error } = await supabase.storage.from(bucket).download(cheminPartie(chemin, i));
    if (error || !data) throw new Error(`Partie ${i + 1}/${parties} introuvable : ${error?.message ?? ''}`);
    morceaux.push(data);
    onProgression?.(Math.round(((i + 1) / parties) * 100));
  }
  return new Blob(morceaux, { type: mime || 'application/octet-stream' });
}
