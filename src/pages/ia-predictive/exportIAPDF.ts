import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AnalyseIA } from '@/types/ia-predictive';

const tendanceLabel: Record<string, string> = {
  amelioration: 'En amelioration',
  stable: 'Stable',
  degradation: 'En degradation',
};

const prioriteLabel: Record<string, string> = {
  haute: 'HAUTE',
  moyenne: 'MOYENNE',
  basse: 'BASSE',
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('fr-FR');
  } catch {
    return iso;
  }
}

export function exportIAPredictivePDF(analyse: AnalyseIA) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('ALBA by Nikito', margin, y);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Rapport IA Predictive', margin, y + 6);
  y += 16;

  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  doc.setFontSize(9);
  const infoLines: [string, string][] = [
    ['Score de sante global', `${analyse.score_sante_global}/100`],
    ['Tendance', tendanceLabel[analyse.tendance] ?? analyse.tendance],
    ['Date du rapport', new Date().toLocaleDateString('fr-FR')],
    ['MTBF prevu (30j)', `${analyse.kpi_predictions.mtbf_prevu_30j.toFixed(1)} jours`],
    ['Incidents prevus (30j)', String(analyse.kpi_predictions.incidents_prevus_30j)],
    ['Conformite prevue', `${Math.round(analyse.kpi_predictions.taux_conformite_prevu)}%`],
    ['Equipements a surveiller', String(analyse.kpi_predictions.equipements_necessitant_attention)],
  ];

  for (const [label, value] of infoLines) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label} :`, margin, y);
    doc.setFont('helvetica', 'normal');
    const labelW = doc.getTextWidth(`${label} : `);
    doc.text(value, margin + labelW, y);
    y += 5;
  }

  y += 6;

  if (analyse.equipements_a_risque.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Equipements a risque', margin, y);
    y += 4;

    const eqHead = [['Code', 'Equipement', 'Parc', 'Risque', 'Priorite', 'Prediction', 'Action']];
    const eqBody = analyse.equipements_a_risque.map((eq) => [
      eq.equipement_code,
      eq.equipement_libelle,
      eq.parc,
      `${eq.score_risque}%`,
      prioriteLabel[eq.priorite] ?? eq.priorite,
      eq.prediction,
      eq.action_recommandee,
    ]);

    autoTable(doc, {
      startY: y,
      head: eqHead,
      body: eqBody,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [11, 11, 46], textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { textColor: [30, 30, 30] },
      columnStyles: {
        0: { cellWidth: 18 },
        3: { cellWidth: 14 },
        4: { cellWidth: 16 },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 4) {
          const val = data.cell.text[0];
          if (val === 'HAUTE') {
            data.cell.styles.textColor = [255, 77, 109];
            data.cell.styles.fontStyle = 'bold';
          } else if (val === 'MOYENNE') {
            data.cell.styles.textColor = [255, 181, 71];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });

    y = ((doc as unknown as Record<string, Record<string, number>>).lastAutoTable?.finalY ?? y) + 8;
  }

  if (analyse.alertes.length > 0) {
    const pageH = doc.internal.pageSize.getHeight();
    if (y > pageH - 50) {
      doc.addPage();
      y = margin;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Alertes', margin, y);
    y += 4;

    const alHead = [['Priorite', 'Type', 'Message', 'Parc']];
    const alBody = analyse.alertes.map((a) => [
      prioriteLabel[a.priorite] ?? a.priorite,
      a.type.replace(/_/g, ' '),
      a.message,
      a.parc,
    ]);

    autoTable(doc, {
      startY: y,
      head: alHead,
      body: alBody,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [11, 11, 46], textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { textColor: [30, 30, 30] },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 28 },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 0) {
          const val = data.cell.text[0];
          if (val === 'HAUTE') {
            data.cell.styles.textColor = [255, 77, 109];
            data.cell.styles.fontStyle = 'bold';
          } else if (val === 'MOYENNE') {
            data.cell.styles.textColor = [255, 181, 71];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });

    y = ((doc as unknown as Record<string, Record<string, number>>).lastAutoTable?.finalY ?? y) + 8;
  }

  if (analyse.recommandations.length > 0) {
    const pageH = doc.internal.pageSize.getHeight();
    if (y > pageH - 50) {
      doc.addPage();
      y = margin;
    }

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Recommandations', margin, y);
    y += 4;

    const recHead = [['Titre', 'Description', 'Impact', 'Cout', 'Deadline']];
    const recBody = analyse.recommandations.map((r) => [
      r.titre,
      r.description,
      r.impact_estime,
      r.cout_estime,
      r.deadline_suggeree ? formatDate(r.deadline_suggeree) : '-',
    ]);

    autoTable(doc, {
      startY: y,
      head: recHead,
      body: recBody,
      margin: { left: margin, right: margin },
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [11, 11, 46], textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { textColor: [30, 30, 30] },
    });

    y = ((doc as unknown as Record<string, Record<string, number>>).lastAutoTable?.finalY ?? y) + 8;
  }

  const pageH = doc.internal.pageSize.getHeight();
  const footerY = Math.max(y + 6, pageH - 20);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120);
  doc.text(
    `Document genere le ${new Date().toLocaleDateString('fr-FR')} a ${new Date().toLocaleTimeString('fr-FR')} — Analyse IA predictive ALBA by Nikito`,
    margin,
    footerY
  );

  const dateStr = new Date().toISOString().slice(0, 10);
  doc.save(`rapport_ia_predictive_${dateStr}.pdf`);
}

export function buildIAPdfBase64(analyse: AnalyseIA): string {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const m = 15;
  let y = m;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('ALBA by Nikito', m, y);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Rapport IA Predictive', m, y + 6);
  y += 16;
  doc.setDrawColor(200);
  doc.line(m, y, pageW - m, y);
  y += 8;

  doc.setFontSize(9);
  const infoLines: [string, string][] = [
    ['Score de sante global', `${analyse.score_sante_global}/100`],
    ['Tendance', tendanceLabel[analyse.tendance] ?? analyse.tendance],
    ['Date du rapport', new Date().toLocaleDateString('fr-FR')],
    ['MTBF prevu (30j)', `${analyse.kpi_predictions.mtbf_prevu_30j.toFixed(1)} jours`],
    ['Incidents prevus (30j)', String(analyse.kpi_predictions.incidents_prevus_30j)],
    ['Conformite prevue', `${Math.round(analyse.kpi_predictions.taux_conformite_prevu)}%`],
    ['Equipements a surveiller', String(analyse.kpi_predictions.equipements_necessitant_attention)],
  ];

  for (const [label, value] of infoLines) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label} :`, m, y);
    doc.setFont('helvetica', 'normal');
    const labelW = doc.getTextWidth(`${label} : `);
    doc.text(value, m + labelW, y);
    y += 5;
  }
  y += 6;

  if (analyse.equipements_a_risque.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Equipements a risque', m, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Code', 'Equipement', 'Parc', 'Risque', 'Priorite', 'Action']],
      body: analyse.equipements_a_risque.map((eq) => [
        eq.equipement_code, eq.equipement_libelle, eq.parc,
        `${eq.score_risque}%`, prioriteLabel[eq.priorite] ?? eq.priorite, eq.action_recommandee,
      ]),
      margin: { left: m, right: m },
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [11, 11, 46], textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { textColor: [30, 30, 30] },
    });
    y = ((doc as unknown as Record<string, Record<string, number>>).lastAutoTable?.finalY ?? y) + 8;
  }

  if (analyse.alertes.length > 0) {
    if (y > doc.internal.pageSize.getHeight() - 50) { doc.addPage(); y = m; }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Alertes', m, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Priorite', 'Type', 'Message', 'Parc']],
      body: analyse.alertes.map((a) => [
        prioriteLabel[a.priorite] ?? a.priorite, a.type.replace(/_/g, ' '), a.message, a.parc,
      ]),
      margin: { left: m, right: m },
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [11, 11, 46], textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { textColor: [30, 30, 30] },
    });
    y = ((doc as unknown as Record<string, Record<string, number>>).lastAutoTable?.finalY ?? y) + 8;
  }

  if (analyse.recommandations.length > 0) {
    if (y > doc.internal.pageSize.getHeight() - 50) { doc.addPage(); y = m; }
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Recommandations', m, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Titre', 'Description', 'Impact', 'Cout', 'Deadline']],
      body: analyse.recommandations.map((r) => [
        r.titre, r.description, r.impact_estime, r.cout_estime,
        r.deadline_suggeree ? formatDate(r.deadline_suggeree) : '-',
      ]),
      margin: { left: m, right: m },
      styles: { fontSize: 7, cellPadding: 2 },
      headStyles: { fillColor: [11, 11, 46], textColor: [255, 255, 255], fontStyle: 'bold' },
      bodyStyles: { textColor: [30, 30, 30] },
    });
  }

  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120);
  doc.text(
    `Document genere le ${new Date().toLocaleDateString('fr-FR')} — Analyse IA predictive ALBA by Nikito`,
    m, pageH - 10,
  );

  return doc.output('datauristring').split(',')[1];
}
