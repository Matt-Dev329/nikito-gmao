import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Donnees necessaires a la generation du PDF de bon de travail (BT).
 * Le texte du PDF reste sans accents : la police helvetica par defaut de
 * jsPDF ne gere pas correctement les caracteres accentues (cf exportPDF.ts).
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
  photoAvantUrl: string | null;
  photoApresUrl: string | null;
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

export function exportInterventionPDF(data: InterventionPDFData) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
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

  const photos: [string, string | null][] = [
    ['Photo avant', data.photoAvantUrl],
    ['Photo apres', data.photoApresUrl],
  ];
  const presentes = photos.filter(([, url]) => !!url);
  if (presentes.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Photos', margin, y);
    y += 5;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    for (const [label, url] of presentes) {
      doc.setTextColor(0, 102, 204);
      doc.textWithLink(`${label} (ouvrir)`, margin, y, { url: url as string });
      doc.setTextColor(30, 30, 30);
      y += 5;
    }
    y += 2;
  }

  const footerY = Math.max(y + 6, doc.internal.pageSize.getHeight() - 20);
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
