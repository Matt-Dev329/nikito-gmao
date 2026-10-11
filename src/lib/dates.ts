/**
 * Dates « métier » en heure de Paris. `toISOString().slice(0, 10)` donne la
 * date UTC : entre 0 h et 2 h (heure de Paris) elle renvoie la veille.
 */
const FUSEAU = 'Europe/Paris';

/** Date locale (Paris) au format AAAA-MM-JJ. */
export function dateParis(d: Date | string | number = new Date()): string {
  return new Date(d).toLocaleDateString('sv-SE', { timeZone: FUSEAU });
}

/** Date du jour à Paris, au format AAAA-MM-JJ. */
export function aujourdhuiParis(): string {
  return dateParis(new Date());
}

/** Vrai si l'instant donné tombe aujourd'hui (heure de Paris). */
export function estAujourdhuiParis(d: Date | string | null | undefined): boolean {
  return !!d && dateParis(d) === aujourdhuiParis();
}
