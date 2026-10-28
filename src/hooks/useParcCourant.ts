import { useEffect, useState } from 'react';
import { create } from 'zustand';

const STORAGE_KEY = 'alba:parc_courant';

export interface ParcCourant {
  id: string;
  code: string;
  nom: string;
}

interface ParcCourantState {
  parc: ParcCourant | null;
  /** Vue « Tous les parcs » (utilisateurs multi-parcs) : aucun parc sélectionné */
  tous: boolean;
  setParc: (p: ParcCourant) => void;
  setTous: () => void;
  clear: () => void;
}

function loadFromStorage(): { parc: ParcCourant | null; tous: boolean } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { parc: null, tous: false };
    const parsed = JSON.parse(raw);
    if (parsed?.tous === true) return { parc: null, tous: true };
    if (parsed?.id && parsed?.code && parsed?.nom) return { parc: parsed as ParcCourant, tous: false };
    return { parc: null, tous: false };
  } catch {
    return { parc: null, tous: false };
  }
}

export const useParcCourant = create<ParcCourantState>((set) => ({
  ...loadFromStorage(),

  setParc: (p) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: p.id, code: p.code, nom: p.nom }));
    set({ parc: p, tous: false });
  },

  setTous: () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ tous: true }));
    set({ parc: null, tous: true });
  },

  clear: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ parc: null, tous: false });
  },
}));

/** Parc choisi en haut à gauche (id), ou null en vue « Tous les parcs » */
export function useParcSelectionne(): string | null {
  return useParcCourant((s) => (s.tous ? null : s.parc?.id ?? null));
}

/** Code du parc choisi en haut à gauche (« SGB »), ou null en vue « Tous les parcs » */
export function useCodeParcSelectionne(): string | null {
  return useParcCourant((s) => (s.tous ? null : s.parc?.code ?? null));
}

/**
 * Filtre parc d'une page, calé sur le parc choisi en haut à gauche : il en
 * part, et le suit quand on change de parc (on peut toujours le changer sur
 * la page). `vide` = valeur du filtre « tous les parcs » de la page ; `cle` =
 * ce que la page met dans son filtre : l'id du parc, son code (« SGB ») ou
 * son libellé (« SGB · Nikito Saint-Genevieve »).
 */
export function useFiltreParc<V extends string | null | undefined>(
  vide: V,
  cle: 'id' | 'code' | 'libelle' = 'id',
): [string | V, (v: string | V) => void] {
  const choisi = useParcCourant((s) => {
    if (s.tous || !s.parc) return null;
    return cle === 'code' ? s.parc.code : cle === 'libelle' ? `${s.parc.code} · ${s.parc.nom}` : s.parc.id;
  });
  const [valeur, setValeur] = useState<string | V>(choisi ?? vide);
  useEffect(() => {
    setValeur(choisi ?? vide);
  }, [choisi, vide]);
  return [valeur, setValeur];
}

/**
 * Ensures the stored parc is still accessible to the user.
 * If not, auto-selects the single parc for mono-parc users or clears for multi-parc.
 * Returns the resolved parc, 'tous' for the all-parcs view (multi-parc users),
 * or null if user needs to pick.
 */
export function resolveParcCourant(
  parcIds: string[],
  allParcs: Array<{ id: string; code: string; nom: string }>,
): ParcCourant | 'tous' | null {
  const store = useParcCourant.getState();
  const current = store.parc;

  if (store.tous && parcIds.length > 1) {
    return 'tous';
  }

  if (current && parcIds.includes(current.id)) {
    return current;
  }

  if (parcIds.length === 1) {
    const match = allParcs.find((p) => p.id === parcIds[0]);
    if (match) {
      const resolved = { id: match.id, code: match.code, nom: match.nom };
      store.setParc(resolved);
      return resolved;
    }
  }

  store.clear();
  return null;
}
