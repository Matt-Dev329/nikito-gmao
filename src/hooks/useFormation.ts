import { create } from 'zustand';

const STORAGE_KEY = 'alba_mode_formation';

interface FormationState {
  active: boolean;
  toggle: () => void;
  enable: () => void;
  disable: () => void;
}

export const useFormation = create<FormationState>((set) => ({
  active: localStorage.getItem(STORAGE_KEY) === 'true',
  toggle: () =>
    set((s) => {
      const next = !s.active;
      localStorage.setItem(STORAGE_KEY, String(next));
      return { active: next };
    }),
  enable: () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    set({ active: true });
  },
  disable: () => {
    localStorage.setItem(STORAGE_KEY, 'false');
    set({ active: false });
  },
}));

export function useFormationFilter() {
  const active = useFormation((s) => s.active);
  return { estFormation: active };
}
