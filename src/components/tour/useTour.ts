import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

interface TourState {
  active: boolean;
  stepIndex: number;
  start: () => void;
  next: () => void;
  skip: () => void;
  setStepCount: (count: number) => void;
  _stepCount: number;
}

function persistTourCompleted() {
  supabase.auth.getUser().then(({ data }) => {
    if (!data.user) return;
    supabase
      .from('utilisateurs')
      .update({ tour_vu: true })
      .eq('auth_user_id', data.user.id)
      .then(() => {});
  });
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
      persistTourCompleted();
      set({ active: false, stepIndex: 0 });
    } else {
      set({ stepIndex: stepIndex + 1 });
    }
  },

  skip: () => {
    persistTourCompleted();
    set({ active: false, stepIndex: 0 });
  },
}));
