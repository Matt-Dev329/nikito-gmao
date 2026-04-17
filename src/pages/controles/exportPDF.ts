import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ControleHistorique, ControleItemDetail } from '@/hooks/queries/useHistoriqueControles';
import { supabase } from '@/lib/supabase';

const typeLabel: Record<string, string> = {
  quotidien: 'Quotidien',
  hebdo: 'Hebdomadaire',
  mensuel: 'Mensuel',
};

const statutLabel: Record<string, string> = {
  valide: 'Valide',
  en_cours: 'En cours',
  echec: 'Echec',
  remplace: 'Remplace',
  a_faire: 'A faire',
};

const etatLabel: Record<string, string> = {
  ok: 'OK',
  degrade: 'DEG',
  hs: 'HS',
};

function formatDateLong(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  const s = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

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

export async function exportControlePDF(controle: ControleHistorique) {
  const { data: itemsRaw } = await supabase
    .from('controle_items')
    .select(`
      id, point_id, etat, commentaire, photo_url,
      point_libelle_snapshot, point_categorie_snapshot,
      bibliotheque_points(libelle, categories_equipement(nom))
    `)
    .eq('controle_id', controle.id);

  const items: ControleItemDetail[] = (itemsRaw ?? []).map((item: Record<string, unknown>) => {
    const bp = item.bibliotheque_points as { libelle: string; categories_equipement: { nom: string } | null } | null;
    return {
      id: item.id as string,
      point_id: item.point_id as string,
      etat: item.etat as string,
      commentaire: item.commentaire as string | null,
      photo_url: item.photo_url as string | null,
      point_libelle_snapshot: item.point_libelle_snapshot as string | null,
      point_categorie_snapshot: item.point_categorie_snapshot as string | null,
      point_libelle: bp?.libelle ?? null,
      point_categorie: bp?.categories_equipement?.nom ?? null,
    };
  });

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = margin;

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('NIKITO GMAO', margin, y);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('Rapport de controle', margin, y + 6);
  y += 16;

  doc.setDrawColor(200);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  const infoLines: [string, string][] = [
    ['Parc', `${controle.parc_code} - ${controle.parc_nom}`],
    ['Date', formatDateLong(controle.date_planifiee)],
    ['Type', typeLabel[controle.type] ?? controle.type],
    ['Controleur', controle.realise_par_nom ?? '-'],
    ['Role', controle.realise_par_role ?? '-'],
    ['Statut', statutLabel[controle.statut] ?? controle.statut],
    ['Duree', formatDuree(controle.date_demarrage, controle.date_validation)],
    ['Points OK / KO', `${controle.nb_ok} / ${controle.nb_ko}`],
  ];

  if (controle.signature_at) {
    infoLines.push(['Signe le', formatDatetime(controle.signature_at)]);
  }
  if (controle.gps_latitude && controle.gps_longitude) {
    infoLines.push(['GPS', `${controle.gps_latitude.toFixed(5)}, ${controle.gps_longitude.toFixed(5)}`]);
  }
  if (controle.hash_integrite) {
    infoLines.push(['Hash integrite', controle.hash_integrite]);
  }
  if (controle.motif_correction) {
    infoLines.push(['Motif correction', controle.motif_correction]);
  }

  doc.setFontSize(9);
  for (const [label, value] of infoLines) {
    doc.setFont('helvetica', 'bold');
    doc.text(`${label} :`, margin, y);
    doc.setFont('helvetica', 'normal');
    const labelW = doc.getTextWidth(`${label} : `);
    doc.text(value, margin + labelW, y);
    y += 5;
  }

  y += 6;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Points de controle', margin, y);
  y += 4;

  const tableHead = [['#', 'Categorie', 'Point de controle', 'Resultat', 'Commentaire']];
  const tableBody = items.map((item, i) => [
    String(i + 1),
    item.point_categorie_snapshot ?? item.point_categorie ?? '-',
    item.point_libelle_snapshot ?? item.point_libelle ?? '-',
    etatLabel[item.etat] ?? item.etat,
    item.commentaire ?? '',
  ]);

  autoTable(doc, {
    startY: y,
    head: tableHead,
    body: tableBody,
    margin: { left: margin, right: margin },
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [11, 11, 46], textColor: [255, 255, 255], fontStyle: 'bold' },
    bodyStyles: { textColor: [30, 30, 30] },
    columnStyles: {
      0: { cellWidth: 8 },
      3: { cellWidth: 16 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        const val = data.cell.text[0];
        if (val === 'HS') {
          data.cell.styles.textColor = [255, 77, 109];
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'DEG') {
          data.cell.styles.textColor = [255, 181, 71];
          data.cell.styles.fontStyle = 'bold';
        } else if (val === 'OK') {
          data.cell.styles.textColor = [77, 208, 158];
        }
      }
    },
  });

  const finalY = ((doc as unknown as Record<string, Record<string, number>>).lastAutoTable?.finalY) ?? doc.internal.pageSize.getHeight() - 30;
  const footerY = Math.max(finalY + 12, doc.internal.pageSize.getHeight() - 20);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(120);
  doc.text(
    `Document genere le ${new Date().toLocaleDateString('fr-FR')} a ${new Date().toLocaleTimeString('fr-FR')} — Ce document fait foi pour les controles reglementaires`,
    margin,
    footerY
  );

  doc.save(`controle_${controle.parc_code}_${controle.type}_${controle.date_planifiee}.pdf`);
}
