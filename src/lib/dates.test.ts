import { describe, expect, it } from 'vitest';
import { dateParis } from './dates';

describe('dateParis', () => {
  it("renvoie la date de Paris, pas la date UTC, juste après minuit", () => {
    // 00:30 à Paris le 12 octobre = 22:30 UTC le 11 octobre (heure d'été)
    expect(dateParis('2026-10-11T22:30:00Z')).toBe('2026-10-12');
  });
  it('gère l’heure d’hiver', () => {
    // 00:30 à Paris le 15 janvier = 23:30 UTC le 14
    expect(dateParis('2026-01-14T23:30:00Z')).toBe('2026-01-15');
  });
});
