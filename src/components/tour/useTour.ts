import { create } from 'zustand';

const TOUR_STORAGE_KEY = 'alba_tour_completed';

interface TourState {
  active: boolean;
  stepIndex: number;
  start: () => void;
  next: () => void;
  skip: () => void;
  setStepCount: (count: number) => void;
  _stepCount: number;
}

export const useTour = create<TourState>((set, get) => ({
  active: false,
  stepIndex: 0,
  _stepCount: 0,

  setStepCount: (count) => set({ _stepCount: count }),

  start: () => set({ active: true, stepIndex: 0 }),

  next: () => {
    const { stepIndex, _stepCount } = get();
    if (stepIndex + 1 >= _stepCount) {
      localStorage.setItem(TOUR_STORAGE_KEY, 'true');
      set({ active: false, stepIndex: 0 });
    } else {
      set({ stepIndex: stepIndex + 1 });
    }
  },

  skip: () => {
    localStorage.setItem(TOUR_STORAGE_KEY, 'true');
    set({ active: false, stepIndex: 0 });
  },
}));

export function isTourCompleted(): boolean {
  return localStorage.getItem(TOUR_STORAGE_KEY) === 'true';
}
