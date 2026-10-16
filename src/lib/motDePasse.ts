/**
 * Règles de mot de passe imposées par Supabase Auth (réglage du projet) :
 * au moins une minuscule, une majuscule, un chiffre et un caractère spécial.
 * On les affiche et on les vérifie avant l'envoi pour éviter un refus
 * incompréhensible côté serveur.
 */
export const LONGUEUR_MIN_MOT_DE_PASSE = 8;

export function reglesMotDePasse(motDePasse: string): { libelle: string; ok: boolean }[] {
  return [
    { libelle: `${LONGUEUR_MIN_MOT_DE_PASSE} caractères minimum`, ok: motDePasse.length >= LONGUEUR_MIN_MOT_DE_PASSE },
    { libelle: 'une minuscule', ok: /[a-z]/.test(motDePasse) },
    { libelle: 'une majuscule', ok: /[A-Z]/.test(motDePasse) },
    { libelle: 'un chiffre', ok: /[0-9]/.test(motDePasse) },
    { libelle: 'un caractère spécial (! ? @ # . - _ …)', ok: /[^A-Za-z0-9]/.test(motDePasse) },
  ];
}

export function motDePasseValide(motDePasse: string): boolean {
  return reglesMotDePasse(motDePasse).every((r) => r.ok);
}
