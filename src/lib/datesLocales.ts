/**
 * Formate une Date (construite en heure locale) en AAAA-MM-JJ sans passer par
 * `toISOString()` : minuit local en France est la veille en UTC.
 */
export function ymdLocal(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${j}`;
}
