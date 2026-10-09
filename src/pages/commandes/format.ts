export function formatPrix(n: number | null | undefined): string {
  if (n == null) return 'Prix à définir';
  return Number(n).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

export function formatDateHeure(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
