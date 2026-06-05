import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';

/**
 * Donnees necessaires a la generation du PDF de bon de travail (BT).
 * Le texte du PDF reste sans accents : la police helvetica par defaut de
 * jsPDF ne gere pas correctement les caracteres accentues (cf exportPDF.ts).
 *
 * photoAvantPath / photoApresPath sont les CHEMINS de stockage Supabase
 * (bucket prive) renvoyes par PhotoCapture, pas des URLs. On genere une URL
 * signee a la volee pour telecharger l'image et l'integrer au PDF.
 */
export interface InterventionPDFData {
  numeroBT: string;
  titre: string;
  equipementLibelle: string;
  equipementCode: string;
  parcNom: string;
  zoneNom: string;
  criticite: string;
  diagnostic: string;
  actions: string;
  resoluPremierCoup: boolean | null;
  debut: string | null;
  fin: string | null;
  technicienNom: string;
  pieces: { nom: string; reference: string; quantite: number }[];
  photoBucket: string;
  photoAvantPath: string | null;
  photoApresPath: string | null;
}

const criticiteLabel: Record<string, string> = {
  bloquant: 'Bloquant',
  majeur: 'Majeur',
  mineur: 'Mineur',
};

function formatDatetime(iso: string | null): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR');
}

function formatDuree(debut: string | null, fin: string | null): string {
  if (!debut || !fin) return '-';
  const ms = new Date(fin).getTime() - new Date(debut).getTime();
  if (ms < 0) return '-';
  const totalMin = Math.floor(ms / 60_000);
  if (totalMin < 60) return `${totalMin}min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h${m > 0 ? ` ${m}min` : ''}`;
}

/** Telecharge une image du storage prive et la convertit en dataURL JPEG. */
async function chargerImage(bucket: string, path: string): Promise<string | null> {
  try {
    const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
    if (!data?.signedUrl) return null;
    const resp = await fetch(data.signedUrl);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export async function exportInterventionPDF(data: InterventionPDFData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;
  const maxW = pageW - margin * 2;
  let y = margin;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('ALBA by Nikito', margin, y);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Bon de travail ${data.numeroBT}`, margin, y + 6);
  y += 16;

  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  const infoLines: [string, string][] = [
    ['Intitule', data.titre || '-'],
    ['Equipement', `${data.equipementCode}${data.equipementCode ? ' - ' : ''}${data.equipementLibelle}`],
    ['Zone', data.zoneNom || '-'],
    ['Parc', data.parcNom || '-'],
    ['Criticite', criticiteLabel[data.criticite] ?? data.criticite],
    ['Technicien', data.technicienNom || '-'],
    ['Debut', formatDatetime(data.debut)],
    ['Fin', formatDatetime(data.fin)],
    ['Duree', formatDuree(data.debut, data.fin)],
    ['Resolu du 1er coup', data.resoluPremierCoup === null ? '-' : data.resoluPremierCoup ? 'Oui' : 'Non'],
  ];

  doc.setFontSize(9);
  for (const [label, value] of infoLines) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label} :`, margin, y);
    doc.setFont('helvetica', 'normal');
    const labelW = doc.getTextWidth(`${label} : `);
    const wrapped = doc.splitTextToSize(value, maxW - labelW);
    doc.text(wrapped, margin + labelW, y);
    y += 5 * wrapped.length;
  }

  y += 4;

  const section = (titre: string, contenu: string) => {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(titre, margin, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    const wrapped = doc.splitTextToSize(contenu || '-', maxW);
    doc.text(wrapped, margin, y);
    y += 5 * wrapped.length + 4;
  };

  section('Diagnostic', data.diagnostic);
  section('Actions realisees', data.actions);

  if (data.pieces.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Pieces utilisees', margin, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [['Piece', 'Reference', 'Qte']],
      body: data.pieces.map((p) => [p.nom, p.reference || '-', String(p.quantite)]),
      margin: { left: margin, right: margin },
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [11, 11, 46], textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { textColor: [30, 30, 30] },
      columnStyles: { 2: { cellWidth: 16 } },
    });
    y = ((doc as unknown as Record<string, Record<string, number>>).lastAutoTable?.finalY ?? y) + 8;
  }

  // Photos integrees (telechargees depuis le storage prive)
  const photos: [string, string | null][] = [
    ['Photo avant intervention', data.photoAvantPath],
    ['Photo apres reparation', data.photoApresPath],
  ];
  const photosPresentes = photos.filter(([, p]) => !!p);

  if (photosPresentes.length > 0) {
    if (y > pageH - 30) {
      doc.addPage();
      y = margin;
    }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Photos', margin, y);
    y += 6;

    const imgW = 90; // largeur max d'une photo en mm
    for (const [label, path] of photosPresentes) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      if (y > pageH - 20) {
        doc.addPage();
        y = margin;
      }
      doc.text(label, margin, y);
      y += 4;

      const dataUrl = await chargerImage(data.photoBucket, path as string);
      if (!dataUrl) {
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(120);
        doc.text('(photo indisponible)', margin, y);
        doc.setTextColor(30, 30, 30);
        y += 8;
        continue;
      }

      let h = imgW;
      try {
        const props = doc.getImageProperties(dataUrl);
        h = (imgW * props.height) / props.width;
      } catch {
        h = imgW * 0.75;
      }
      if (y + h > pageH - margin) {
        doc.addPage();
        y = margin;
      }
      try {
        doc.addImage(dataUrl, 'JPEG', margin, y, imgW, h);
      } catch {
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(120);
        doc.text('(photo illisible)', margin, y);
        doc.setTextColor(30, 30, 30);
        h = 4;
      }
      y += h + 8;
    }
  }

  const footerY = Math.max(y + 6, pageH - 12);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120);
  doc.text(
    `Document genere le ${new Date().toLocaleDateString('fr-FR')} a ${new Date().toLocaleTimeString('fr-FR')}`,
    margin,
    footerY
  );

  doc.save(`BT_${data.numeroBT}.pdf`);
}
