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
      onError: (e) => reject(new Error(`Envoi interrompu : ${e.message}`)),
      onProgress: (envoye, total) => onProgression?.(Math.round((envoye / total) * 100)),
      onSuccess: () => resolve(),
    });
    envoi.findPreviousUploads().then((precedents) => {
      if (precedents.length) envoi.resumeFromPreviousUpload(precedents[0]);
      envoi.start();
    }, reject);
  });
}
