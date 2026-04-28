import { create } from 'zustand';

const STORAGE_KEY = 'alba:parc_courant';

export interface ParcCourant {
  id: string;
  code: string;
  nom: string;
}

interface ParcCourantState {
  parc: ParcCourant | null;
  setParc: (p: ParcCourant) => void;
  clear: () => void;
}

function loadFromStorage(): ParcCourant | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.id && parsed?.code && parsed?.nom) return parsed as ParcCourant;
    return null;
  } catch {
    return null;
  }
}

export const useParcCourant = create<ParcCourantState>((set) => ({
  parc: loadFromStorage(),

  setParc: (p) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: p.id, code: p.code, nom: p.nom }));
    set({ parc: p });
  },

  clear: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ parc: null });
  },
}));

/**
 * Ensures the stored parc is still accessible to the user.
 * If not, auto-selects the single parc for mono-parc users or clears for multi-parc.
 * Returns the resolved parc (or null if user needs to pick).
 */
export function resolveParcCourant(
  parcIds: string[],
  allParcs: Array<{ id: string; code: string; nom: string }>,
): ParcCourant | null {
  const store = useParcCourant.getState();
  const current = store.parc;

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
