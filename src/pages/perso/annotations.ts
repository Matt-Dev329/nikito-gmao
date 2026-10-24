/**
 * Annotations des photos du bloc-notes : cotes (mesure entre deux points),
 * flèches et textes. Coordonnées en fraction de la photo (0 à 1) pour rester
 * justes quelle que soit la taille d'affichage. Le même tracé sert à l'écran
 * (SVG) et à l'export de la photo annotée (canvas).
 */

export type CouleurAnnotation = 'lime' | 'amber' | 'red' | 'cyan' | 'blanc';
export type TypeAnnotation = 'cote' | 'fleche' | 'texte';

export interface Annotation {
  id: string;
  type: TypeAnnotation;
  x1: number;
  y1: number;
  x2?: number;
  y2?: number;
  texte: string;
  couleur: CouleurAnnotation;
}

export interface PhotoNote {
  chemin: string;
  largeur: number;
  hauteur: number;
  legende?: string | null;
  annotations: Annotation[];
}

/** Classes Tailwind par couleur (trait SVG, texte SVG, pastille, couleur CSS pour l'export) */
export const COULEURS: Record<CouleurAnnotation, { trait: string; texte: string; pastille: string; css: string }> = {
  lime: { trait: 'stroke-lime', texte: 'fill-lime', pastille: 'bg-lime', css: 'text-lime' },
  amber: { trait: 'stroke-amber', texte: 'fill-amber', pastille: 'bg-amber', css: 'text-amber' },
  red: { trait: 'stroke-red', texte: 'fill-red', pastille: 'bg-red', css: 'text-red' },
  cyan: { trait: 'stroke-nikito-cyan', texte: 'fill-nikito-cyan', pastille: 'bg-nikito-cyan', css: 'text-nikito-cyan' },
  blanc: { trait: 'stroke-text', texte: 'fill-text', pastille: 'bg-text', css: 'text-text' },
};

export interface Formes {
  /** Segments [x1, y1, x2, y2] en pixels de la photo */
  segments: [number, number, number, number][];
  etiquette: { x: number; y: number; texte: string } | null;
}

/** Échelle des traits et du texte, proportionnelle à la photo */
export function echelle(largeur: number, hauteur: number) {
  const base = Math.max(largeur, hauteur);
  return { trait: Math.max(2, base / 320), police: Math.max(14, base / 38) };
}

/** Tracé d'une annotation en pixels de la photo */
export function formes(a: Annotation, largeur: number, hauteur: number): Formes {
  const { trait } = echelle(largeur, hauteur);
  const x1 = a.x1 * largeur;
  const y1 = a.y1 * hauteur;
  if (a.type === 'texte' || a.x2 === undefined || a.y2 === undefined) {
    return { segments: [], etiquette: a.texte ? { x: x1, y: y1, texte: a.texte } : null };
  }
  const x2 = a.x2 * largeur;
  const y2 = a.y2 * hauteur;
  const longueur = Math.hypot(x2 - x1, y2 - y1) || 1;
  const ux = (x2 - x1) / longueur;
  const uy = (y2 - y1) / longueur;
  // Perpendiculaire
  const px = -uy;
  const py = ux;
  const segments: Formes['segments'] = [[x1, y1, x2, y2]];

  if (a.type === 'cote') {
    // Traits de rappel aux deux bouts + petites flèches vers l'intérieur
    const t = trait * 5;
    const f = trait * 4;
    segments.push([x1 - px * t, y1 - py * t, x1 + px * t, y1 + py * t]);
    segments.push([x2 - px * t, y2 - py * t, x2 + px * t, y2 + py * t]);
    segments.push([x1, y1, x1 + (ux + px * 0.6) * f, y1 + (uy + py * 0.6) * f]);
    segments.push([x1, y1, x1 + (ux - px * 0.6) * f, y1 + (uy - py * 0.6) * f]);
    segments.push([x2, y2, x2 - (ux + px * 0.6) * f, y2 - (uy + py * 0.6) * f]);
    segments.push([x2, y2, x2 - (ux - px * 0.6) * f, y2 - (uy - py * 0.6) * f]);
    return { segments, etiquette: a.texte ? { x: (x1 + x2) / 2, y: (y1 + y2) / 2, texte: a.texte } : null };
  }

  // Flèche : pointe au point d'arrivée, texte au départ
  const f = trait * 6;
  segments.push([x2, y2, x2 - (ux + px * 0.5) * f, y2 - (uy + py * 0.5) * f]);
  segments.push([x2, y2, x2 - (ux - px * 0.5) * f, y2 - (uy - py * 0.5) * f]);
  return { segments, etiquette: a.texte ? { x: x1, y: y1, texte: a.texte } : null };
}

/** Couleur CSS calculée d'une classe Tailwind (pour dessiner sur le canvas sans couleur en dur) */
function couleurCalculee(classe: string): string {
  const el = document.createElement('span');
  el.className = classe;
  el.style.display = 'none';
  document.body.appendChild(el);
  const c = getComputedStyle(el).color;
  el.remove();
  return c;
}

/** Photo annotée en JPEG (pour l'envoyer ou l'enregistrer) */
export async function exporterPhotoAnnotee(url: string, photo: PhotoNote): Promise<Blob> {
  const reponse = await fetch(url);
  if (!reponse.ok) throw new Error('Photo introuvable');
  const image = await createImageBitmap(await reponse.blob());
  const largeur = image.width;
  const hauteur = image.height;
  const canvas = document.createElement('canvas');
  canvas.width = largeur;
  canvas.height = hauteur;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas non supporté');
  ctx.drawImage(image, 0, 0);

  const { trait, police } = echelle(largeur, hauteur);
  const fond = couleurCalculee('text-bg-app');
  ctx.lineCap = 'round';
  ctx.font = `bold ${police}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const a of photo.annotations) {
    const couleur = couleurCalculee(COULEURS[a.couleur].css);
    const { segments, etiquette } = formes(a, largeur, hauteur);
    for (const [x1, y1, x2, y2] of segments) {
      // Liseré sombre sous le trait pour rester lisible sur toutes les photos
      ctx.strokeStyle = fond;
      ctx.lineWidth = trait * 2.2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      ctx.strokeStyle = couleur;
      ctx.lineWidth = trait;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    if (etiquette) {
      const l = ctx.measureText(etiquette.texte).width + police * 0.8;
      const h = police * 1.5;
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = fond;
      ctx.fillRect(etiquette.x - l / 2, etiquette.y - h / 2, l, h);
      ctx.globalAlpha = 1;
      ctx.fillStyle = couleur;
      ctx.fillText(etiquette.texte, etiquette.x, etiquette.y);
    }
  }
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Export impossible'))), 'image/jpeg', 0.9)
  );
}

/** Envoie la photo annotée (partage du téléphone) ou la télécharge */
export async function partagerPhotoAnnotee(url: string, photo: PhotoNote, nom: string): Promise<'partagee' | 'telechargee'> {
  const blob = await exporterPhotoAnnotee(url, photo);
  const fichier = new File([blob], `${nom.replace(/[^\w-]+/g, '_') || 'photo'}.jpg`, { type: 'image/jpeg' });
  if (navigator.canShare?.({ files: [fichier] })) {
    try {
      await navigator.share({ files: [fichier], title: nom });
      return 'partagee';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'partagee';
    }
  }
  const lien = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = lien;
  a.download = fichier.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(lien), 10_000);
  return 'telechargee';
}
