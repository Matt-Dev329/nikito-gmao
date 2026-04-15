import clsx, { type ClassValue } from 'clsx';

/** clsx wrapper for conditional classes */
export const cn = (...inputs: ClassValue[]) => clsx(inputs);

/** Format date FR · ex: "mer. 15 avril" */
export function formatDateCourt(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });
}

/** Format date complète FR · ex: "Mercredi 15 avril 2026" */
export function formatDateLong(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const s = d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Format heure FR · ex: "14:32" */
export function formatHeure(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/** Format durée écoulée · ex: "2j 4h" ou "23 min" */
export function formatDuree(debutISO: string, finISO?: string): string {
  const debut = new Date(debutISO).getTime();
  const fin = finISO ? new Date(finISO).getTime() : Date.now();
  const diffMin = Math.floor((fin - debut) / 60_000);
  if (diffMin < 60) return `${diffMin} min`;
  const heures = Math.floor(diffMin / 60);
  if (heures < 24) return `${heures}h ${diffMin % 60}min`;
  const jours = Math.floor(heures / 24);
  return `${jours}j ${heures % 24}h`;
}

/** Format chrono live · ex: "23:14" (mm:ss) ou "1:23:14" (h:mm:ss) */
export function formatChrono(secondes: number): string {
  const h = Math.floor(secondes / 3600);
  const m = Math.floor((secondes % 3600) / 60);
  const s = secondes % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}
