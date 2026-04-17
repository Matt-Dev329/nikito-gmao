import type { ControleHistorique } from '@/hooks/queries/useHistoriqueControles';

function formatDuree(debut: string | null, fin: string | null): string {
  if (!debut || !fin) return '';
  const ms = new Date(fin).getTime() - new Date(debut).getTime();
  if (ms < 0) return '';
  const totalMin = Math.floor(ms / 60_000);
  if (totalMin < 60) return `${totalMin}min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h${m > 0 ? `${m}min` : ''}`;
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function exportControlesCSV(controles: ControleHistorique[], dateDebut: string, dateFin: string) {
  const headers = ['date', 'parc', 'type', 'controleur', 'statut', 'nb_points_ok', 'nb_points_ko', 'duree', 'hash'];

  const rows = controles.map((c) => [
    c.date_planifiee,
    c.parc_code,
    c.type,
    c.realise_par_nom ?? '',
    c.statut,
    String(c.nb_ok),
    String(c.nb_ko),
    formatDuree(c.date_demarrage, c.date_validation),
    c.hash_integrite ?? '',
  ]);

  const csv = [
    headers.map(escapeCSV).join(','),
    ...rows.map((row) => row.map(escapeCSV).join(',')),
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `controles_NIKITO_${dateDebut}_${dateFin}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
