import { describe, it, expect } from 'vitest';
import {
  getJourSemaine,
  formatHeure,
  parseHeureEnMinutes,
  getHeureAlerte,
  getMinutesDuJour,
  getHorairesAujourdhui,
} from './horaires';
import type { Parc } from '@/types/database';

describe('getJourSemaine', () => {
  it('renvoie le jour FR (dates construites en local)', () => {
    expect(getJourSemaine(new Date(2026, 5, 7))).toBe('dimanche'); // 7 juin 2026
    expect(getJourSemaine(new Date(2026, 5, 8))).toBe('lundi');
  });
});

describe('formatHeure', () => {
  it('formate les heures rondes et minutes', () => {
    expect(formatHeure('09:00')).toBe('9h');
    expect(formatHeure('09:30')).toBe('9h30');
    expect(formatHeure('14:05')).toBe('14h05');
    expect(formatHeure(null)).toBe('--');
  });
});

describe('parseHeureEnMinutes', () => {
  it('convertit HH:MM en minutes', () => {
    expect(parseHeureEnMinutes('00:00')).toBe(0);
    expect(parseHeureEnMinutes('09:30')).toBe(570);
    expect(parseHeureEnMinutes('14:00')).toBe(840);
  });
});

describe('getHeureAlerte', () => {
  it('alerte app à -120 min et SMS à -30 min de l’ouverture', () => {
    expect(getHeureAlerte('09:00')).toEqual({ alerteApp: 420, alerteSms: 510 });
  });
});

describe('getMinutesDuJour', () => {
  it('minutes écoulées depuis minuit', () => {
    expect(getMinutesDuJour(new Date(2026, 5, 7, 14, 30))).toBe(870);
    expect(getMinutesDuJour(new Date(2026, 5, 7, 0, 0))).toBe(0);
  });
});

describe('getHorairesAujourdhui', () => {
  it('fermé si aucun horaire', () => {
    const parc = { horaires: null, meta: null } as unknown as Parc;
    expect(getHorairesAujourdhui(parc).ferme).toBe(true);
  });

  it('renvoie l’horaire du jour courant', () => {
    const parc = {
      horaires: { lundi: { ouverture: '09:00', fermeture: '19:00', ferme: false } },
      meta: null,
    } as unknown as Parc;
    const h = getHorairesAujourdhui(parc, new Date(2026, 5, 8)); // lundi
    expect(h.ferme).toBe(false);
    expect(h.ouverture).toBe('09:00');
    expect(h.fermeture).toBe('19:00');
  });
});
