import { create } from 'zustand';

// Panier de l'onglet Commander : conservé dans le navigateur (localStorage)
// jusqu'à l'envoi de la commande, pour ne rien perdre en cas de coupure.
// Les tablettes étant partagées, le panier est rattaché à un utilisateur.

const STORAGE_KEY = 'alba:panier_commande';

/** produit_id → quantité */
type Lignes = Record<string, number>;

interface Stocke {
  proprietaire: string | null;
  lignes: Lignes;
}

interface PanierState extends Stocke {
  /** À appeler avec l'utilisateur connecté : repart d'un panier vide s'il a changé. */
  rattacher: (utilisateurId: string) => void;
  ajouter: (produitId: string, quantite?: number) => void;
  definir: (produitId: string, quantite: number) => void;
  retirer: (produitId: string) => void;
  vider: () => void;
}

function charger(): Stocke {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === 'object' && parsed.lignes && typeof parsed.lignes === 'object') {
      return { proprietaire: parsed.proprietaire ?? null, lignes: parsed.lignes as Lignes };
    }
  } catch {
    /* ignore */
  }
  return { proprietaire: null, lignes: {} };
}

function persister(etat: Stocke) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(etat));
  } catch {
    /* stockage indisponible : le panier reste en mémoire */
  }
}

export const usePanier = create<PanierState>((set, get) => {
  const maj = (lignes: Lignes) => {
    persister({ proprietaire: get().proprietaire, lignes });
    set({ lignes });
  };
  return {
    ...charger(),
    rattacher: (utilisateurId) => {
      if (get().proprietaire === utilisateurId) return;
      persister({ proprietaire: utilisateurId, lignes: {} });
      set({ proprietaire: utilisateurId, lignes: {} });
    },
    ajouter: (produitId, quantite = 1) => {
      const lignes = { ...get().lignes };
      lignes[produitId] = (lignes[produitId] ?? 0) + quantite;
      maj(lignes);
    },
    definir: (produitId, quantite) => {
      const lignes = { ...get().lignes };
      if (quantite > 0) lignes[produitId] = quantite;
      else delete lignes[produitId];
      maj(lignes);
    },
    retirer: (produitId) => {
      const lignes = { ...get().lignes };
      delete lignes[produitId];
      maj(lignes);
    },
    vider: () => maj({}),
  };
});

export function nombreArticles(lignes: Lignes): number {
  return Object.values(lignes).reduce((s, q) => s + q, 0);
}
