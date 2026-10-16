/**
 * Téléchargement d'un fichier (photo, vidéo, document) sur l'appareil.
 *
 * Les URL signées Supabase sont sur un autre domaine : l'attribut `download`
 * d'un lien y est ignoré. On récupère donc le fichier puis on le propose à
 * l'enregistrement ; en dernier recours, il s'ouvre dans un nouvel onglet.
 */

/** Nom de fichier à partir d'un chemin ou d'une URL (sans paramètres). */
export function nomDepuisChemin(cheminOuUrl: string, prefixe?: string): string {
  const base = decodeURIComponent(cheminOuUrl.split('?')[0].split('/').pop() || 'fichier');
  return prefixe ? `${prefixe}_${base}` : base;
}

/** Propose l'enregistrement d'un contenu déjà chargé. */
export function enregistrerBlob(blob: Blob, nom: string): void {
  const lien = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = lien;
  a.download = nom;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(lien), 60_000);
}

/** Télécharge le fichier situé à `url` sous le nom `nom`. */
export async function telechargerUrl(url: string, nom: string): Promise<void> {
  try {
    const reponse = await fetch(url);
    if (!reponse.ok) throw new Error(String(reponse.status));
    enregistrerBlob(await reponse.blob(), nom);
  } catch {
    window.open(url, '_blank', 'noopener');
  }
}
