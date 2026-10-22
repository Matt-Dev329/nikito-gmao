import { jsPDF } from 'jspdf';
import { supabase } from '@/lib/supabase';
import { estCheminVideo } from '@/lib/utils';
import type { AlbaBucket } from '@/lib/uploadPhotoControle';

/** Bon d'intervention (réparation hors ticket) tel qu'enregistré en base. */
export interface BonIntervention {
  id: string;
  numero: string | null;
  parc_id: string | null;
  activite: string | null;
  equipement: string | null;
  date_intervention: string;
  duree_minutes: number | null;
  probleme: string | null;
  travaux: string;
  pieces: string | null;
  medias: string[];
  technicien_nom: string;
  signature_technicien: string;
  responsable_nom: string;
  signature_responsable: string;
  /** Test de l'activité fait après l'intervention (null : bon antérieur à la question) */
  test_activite?: boolean | null;
  cree_le: string;
  parc?: { code: string; nom: string } | null;
}

export const BUCKET_BONS: AlbaBucket = 'alba-bons';

// La police helvetica de jsPDF gère mal les accents (cf. exportInterventionPDF)
const sansAccents = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’‘]/g, "'");

async function chargerImage(chemin: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const { data } = await supabase.storage.from(BUCKET_BONS).createSignedUrl(chemin, 600);
    if (!data?.signedUrl) return null;
    const blob = await (await fetch(data.signedUrl)).blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 4, h: 3 });
      img.src = dataUrl;
    });
    return { data: dataUrl, ...dims };
  } catch {
    return null;
  }
}

export function formatDuree(min: number | null): string {
  if (min === null || min === undefined) return '-';
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}

export async function exportBonPDF(bon: BonIntervention): Promise<void> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const maxW = pageW - margin * 2;
  let y = margin;

  const placeRestante = (besoin: number) => {
    if (y + besoin > pageH - margin) {
      doc.addPage();
      y = margin;
    }
  };

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('ALBA by Nikito', margin, y);
  doc.setFontSize(12);
  doc.text(sansAccents(`Bon d'intervention ${bon.numero ?? ''}`), margin, y + 7);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Reparation realisee hors ticket', margin, y + 12);
  y += 18;
  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 7;

  const infos: [string, string][] = [
    ['Parc', bon.parc ? `${bon.parc.code} - ${bon.parc.nom}` : '-'],
    ['Activite', bon.activite || '-'],
    ['Equipement', bon.equipement || '-'],
    ['Date', new Date(bon.date_intervention).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })],
    ['Duree', formatDuree(bon.duree_minutes)],
    ['Technicien', bon.technicien_nom],
  ];
  doc.setFontSize(9);
  for (const [label, valeur] of infos) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label} :`, margin, y);
    doc.setFont('helvetica', 'normal');
    const lw = doc.getTextWidth(`${label} : `);
    const lignes = doc.splitTextToSize(sansAccents(valeur), maxW - lw);
    doc.text(lignes, margin + lw, y);
    y += 5 * lignes.length;
  }
  y += 4;

  const section = (titre: string, contenu: string | null) => {
    const lignes = doc.splitTextToSize(sansAccents(contenu || '-'), maxW);
    placeRestante(10 + 5 * Math.min(lignes.length, 5));
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(titre, margin, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    for (const l of lignes) {
      placeRestante(5);
      doc.text(l, margin, y);
      y += 5;
    }
    y += 4;
  };
  section('Probleme constate', bon.probleme);
  section('Travaux realises', bon.travaux);
  section('Pieces utilisees', bon.pieces);
  if (bon.test_activite != null) section("Test de l'activite", bon.test_activite ? 'Oui' : 'Non');

  // Photos (les vidéos sont seulement mentionnées)
  const photos = bon.medias.filter((m) => !estCheminVideo(m));
  const videos = bon.medias.length - photos.length;
  if (photos.length || videos) {
    placeRestante(12);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Photos', margin, y);
    y += 5;
    if (videos) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`${videos} video(s) disponible(s) dans ALBA`, margin, y);
      y += 6;
    }
    const largeur = (maxW - 6) / 2;
    let colonne = 0;
    let hauteurLigne = 0;
    for (const chemin of photos) {
      const img = await chargerImage(chemin);
      if (!img) continue;
      const h = Math.min(largeur * (img.h / img.w), 90);
      const w = h / (img.h / img.w);
      if (colonne === 0) placeRestante(h + 4);
      try {
        doc.addImage(img.data, margin + colonne * (largeur + 6), y, w, h);
      } catch {
        // format non pris en charge (HEIC…) : ignoré
      }
      hauteurLigne = Math.max(hauteurLigne, h);
      colonne = 1 - colonne;
      if (colonne === 0) {
        y += hauteurLigne + 4;
        hauteurLigne = 0;
      }
    }
    if (colonne === 1) y += hauteurLigne + 4;
  }

  // Signatures
  placeRestante(50);
  y += 4;
  const largeurSig = (maxW - 10) / 2;
  const signatures: [string, string, string][] = [
    ['Signature du technicien', bon.technicien_nom, bon.signature_technicien],
    ['Signature du responsable', bon.responsable_nom, bon.signature_responsable],
  ];
  for (let i = 0; i < signatures.length; i++) {
    const [titre, nom, chemin] = signatures[i];
    const x = margin + i * (largeurSig + 10);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(titre, x, y);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(sansAccents(nom), x, y + 5);
    doc.setDrawColor(200);
    doc.rect(x, y + 8, largeurSig, 32);
    const img = await chargerImage(chemin);
    if (img) {
      const h = Math.min(30, largeurSig * (img.h / img.w));
      try {
        doc.addImage(img.data, 'PNG', x + 1, y + 9, h / (img.h / img.w), h);
      } catch {
        // signature illisible
      }
    }
  }
  y += 46;
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Edite le ${new Date().toLocaleString('fr-FR')} - ALBA by Nikito`, margin, pageH - 8);

  doc.save(`${bon.numero ?? 'bon-intervention'}.pdf`);
}
