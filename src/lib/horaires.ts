import type { Parc, JourSemaine } from '@/types/database';

const JOURS: JourSemaine[] = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

export const JOURS_ORDERED: JourSemaine[] = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];

export interface HorairesDuJour {
  ouverture: string | null;
  fermeture: string | null;
  ferme: boolean;
  estVacances: boolean;
  estDernierDimancheVacances: boolean;
}

export function getJourSemaine(date: Date = new Date()): JourSemaine {
  return JOURS[date.getDay()];
}

export function getHorairesAujourdhui(parc: Parc, date: Date = new Date()): HorairesDuJour {
  const jourSemaine = getJourSemaine(date);
  const horaires = parc.horaires;
  const estVacances = parc.meta?.est_vacances === true;

  if (!horaires) {
    return { ouverture: null, fermeture: null, ferme: true, estVacances: false, estDernierDimancheVacances: false };
  }

  if (estVacances && horaires.vacances) {
    const vacances = horaires.vacances;
    let fermeture = vacances.fermeture;
    let estDernierDimanche = false;

    if (jourSemaine === 'dimanche' && vacances.dernier_dimanche_fermeture) {
      const dateFin = parc.meta?.date_fin_vacances;
      if (dateFin) {
        const finVacances = new Date(dateFin + 'T00:00:00');
        const aujourdhui = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const diffMs = finVacances.getTime() - aujourdhui.getTime();
        const diffJours = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffJours >= 0 && diffJours <= 6) {
          fermeture = vacances.dernier_dimanche_fermeture;
          estDernierDimanche = true;
        }
      }
    }

    return {
      ouverture: vacances.ouverture,
      fermeture,
      ferme: false,
      estVacances: true,
      estDernierDimancheVacances: estDernierDimanche,
    };
  }

  const horaireJour = horaires[jourSemaine];
  if (!horaireJour) {
    return { ouverture: null, fermeture: null, ferme: true, estVacances: false, estDernierDimancheVacances: false };
  }

  return {
    ouverture: horaireJour.ouverture,
    fermeture: horaireJour.fermeture,
    ferme: horaireJour.ferme,
    estVacances: false,
    estDernierDimancheVacances: false,
  };
}

export function formatHeure(h: string | null): string {
  if (!h) return '--';
  const [hh, mm] = h.split(':');
  if (mm === '00') return `${parseInt(hh)}h`;
  return `${parseInt(hh)}h${mm}`;
}

export function parseHeureEnMinutes(h: string): number {
  const [hh, mm] = h.split(':').map(Number);
  return hh * 60 + (mm || 0);
}

export function getHeureAlerte(ouverture: string): { alerteApp: number; alerteSms: number } {
  const ouvertureMin = parseHeureEnMinutes(ouverture);
  return {
    alerteApp: ouvertureMin - 120,
    alerteSms: ouvertureMin - 30,
  };
}

export function getMinutesDuJour(date: Date = new Date()): number {
  return date.getHours() * 60 + date.getMinutes();
}

export function getHorairesForDate(parc: Parc, date: Date): HorairesDuJour {
  return getHorairesAujourdhui(parc, date);
}

export function getHorairesSemaine(parc: Parc, dateDebut: Date): Array<{ jour: JourSemaine; date: Date; horaires: HorairesDuJour }> {
  const result: Array<{ jour: JourSemaine; date: Date; horaires: HorairesDuJour }> = [];
  const lundi = new Date(dateDebut);
  const dayOfWeek = lundi.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  lundi.setDate(lundi.getDate() + diffToMonday);

  for (let i = 0; i < 7; i++) {
    const d = new Date(lundi);
    d.setDate(lundi.getDate() + i);
    result.push({
      jour: JOURS_ORDERED[i],
      date: d,
      horaires: getHorairesForDate(parc, d),
    });
  }
  return result;
}
