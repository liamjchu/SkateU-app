import { create } from 'zustand';
import {
  DEFAULT_MAP_CENTER,
  parseMapRouteFocus,
  schoolFromSpot,
} from '../lib/mapFocus';
import type { School } from '../types/school';
import type { Spot } from '../types/spot';

type MapFocusState = {
  school: School | null;
  latitude: number;
  longitude: number;
  spotId: string | null;
  cameraGeneration: number;
  hasUserChosenFocus: boolean;
  setSchoolFocus: (
    school: School,
    options?: { spotId?: string; latitude?: number; longitude?: number }
  ) => void;
  setCoordinateFocus: (
    latitude: number,
    longitude: number,
    options?: { spotId?: string | null; school?: School | null }
  ) => void;
  setSpotFocus: (spot: Spot) => void;
  applyRouteParams: (
    params: Record<string, string | string[] | undefined>,
    catalog: School[]
  ) => void;
  dismissSchool: () => void;
  consumeSpotId: () => string | null;
  reset: () => void;
};

const initialState = {
  school: null as School | null,
  latitude: DEFAULT_MAP_CENTER.latitude,
  longitude: DEFAULT_MAP_CENTER.longitude,
  spotId: null as string | null,
  cameraGeneration: 0,
  hasUserChosenFocus: false,
};

export const useMapFocusStore = create<MapFocusState>((set, get) => ({
  ...initialState,
  setSchoolFocus: (school, options) => {
    set({
      school,
      latitude: options?.latitude ?? school.lat,
      longitude: options?.longitude ?? school.lng,
      spotId: options?.spotId ?? null,
      cameraGeneration: get().cameraGeneration + 1,
      hasUserChosenFocus: true,
    });
  },
  setCoordinateFocus: (latitude, longitude, options) => {
    set({
      school: options?.school ?? null,
      latitude,
      longitude,
      spotId: options?.spotId ?? null,
      cameraGeneration: get().cameraGeneration + 1,
      hasUserChosenFocus: true,
    });
  },
  setSpotFocus: (spot) => {
    set({
      school: schoolFromSpot(spot),
      latitude: spot.latitude,
      longitude: spot.longitude,
      spotId: spot.id,
      cameraGeneration: get().cameraGeneration + 1,
      hasUserChosenFocus: true,
    });
  },
  applyRouteParams: (params, catalog) => {
    const parsed = parseMapRouteFocus(params, catalog);
    if (!parsed) {
      return;
    }

    set({
      school: parsed.school,
      latitude: parsed.latitude,
      longitude: parsed.longitude,
      spotId: parsed.spotId,
      cameraGeneration: get().cameraGeneration + 1,
      hasUserChosenFocus: true,
    });
  },
  dismissSchool: () => {
    set({
      school: null,
      spotId: null,
    });
  },
  consumeSpotId: () => {
    const spotId = get().spotId;
    if (spotId) {
      set({ spotId: null });
    }
    return spotId;
  },
  reset: () => set(initialState),
}));
