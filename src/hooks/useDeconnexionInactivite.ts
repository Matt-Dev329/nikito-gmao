import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

const CLE = 'alba_derniere_activite';
const EVENEMENTS = ['pointerdown', 'keydown', 'touchstart', 'wheel', 'scroll'] as const;

const lire = (): number => {
  try {
    return Number(localStorage.getItem(CLE)) || 0;
  } catch {
    return 0;
  }
};
const ecrire = (t: number) => {
  try {
    localStorage.setItem(CLE, String(t));
  } catch {
    // stockage indisponible : le suivi reste en mémoire
  }
};

/**
 * Déconnexion automatique après `deconnexion_inactivite_min` minutes sans
 * activité (toucher, clavier, défilement), pour les seuls comptes réglés
 * ainsi en base. Le compte reste actif : la personne se reconnecte. Vérifié
 * toutes les 30 s et au retour sur l'application (tablette en veille).
 */
export function useDeconnexionInactivite() {
  const { utilisateur, authUser, signOut } = useAuth();
  const minutes = utilisateur?.deconnexion_inactivite_min ?? null;
  const connexion = authUser?.last_sign_in_at ? Date.parse(authUser.last_sign_in_at) : 0;

  useEffect(() => {
    if (!minutes) return;
    const delai = minutes * 60_000;
    // Une connexion récente compte comme activité
    let derniere = Math.max(lire(), connexion);
    let ecritLe = 0;
    let fini = false;

    const activite = () => {
      derniere = Date.now();
      // Écriture partagée entre onglets, au plus toutes les 5 s
      if (derniere - ecritLe > 5_000) {
        ecritLe = derniere;
        ecrire(derniere);
      }
    };

    const verifier = async () => {
      if (fini) return;
      derniere = Math.max(derniere, lire());
      if (Date.now() - derniere < delai) return;
      fini = true;
      try {
        localStorage.removeItem(CLE);
      } catch {
        // rien à nettoyer
      }
      await signOut();
      window.location.replace('/');
    };

    const auRetour = () => {
      if (document.visibilityState === 'visible') void verifier();
    };

    void verifier();
    if (!fini) activite();
    EVENEMENTS.forEach((e) => window.addEventListener(e, activite, { passive: true, capture: true }));
    document.addEventListener('visibilitychange', auRetour);
    const minuterie = window.setInterval(() => void verifier(), 30_000);
    return () => {
      EVENEMENTS.forEach((e) => window.removeEventListener(e, activite, { capture: true }));
      document.removeEventListener('visibilitychange', auRetour);
      window.clearInterval(minuterie);
    };
  }, [minutes, connexion, signOut]);
}
