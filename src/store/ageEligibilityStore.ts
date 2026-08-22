import { create } from 'zustand';

type AgeEligibilityState = {
  confirmedThisSession: boolean;
  markEligible: () => void;
  clear: () => void;
};

export const useAgeEligibilityStore = create<AgeEligibilityState>((set) => ({
  confirmedThisSession: false,
  markEligible: () => set({ confirmedThisSession: true }),
  clear: () => set({ confirmedThisSession: false }),
}));
