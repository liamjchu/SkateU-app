import { create } from 'zustand';

export type UserLocationStatus =
  | 'idle'
  | 'requesting'
  | 'ready'
  | 'denied'
  | 'unavailable';

export type UserLocationCoords = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

type LocationStore = {
  coords: UserLocationCoords | null;
  status: UserLocationStatus;
  updatedAt: number | null;
  setLocation: (coords: UserLocationCoords) => void;
  setStatus: (status: UserLocationStatus) => void;
};

export const useLocationStore = create<LocationStore>((set) => ({
  coords: null,
  status: 'idle',
  updatedAt: null,
  setLocation: (coords) =>
    set({
      coords,
      status: 'ready',
      updatedAt: Date.now(),
    }),
  setStatus: (status) => set({ status }),
}));
