import { create } from 'zustand';

export type MapLayer = 'default' | 'satellite';

type MapViewStore = {
  mapLayer: MapLayer;
  setMapLayer: (mapLayer: MapLayer) => void;
};

export const useMapViewStore = create<MapViewStore>((set) => ({
  mapLayer: 'default',
  setMapLayer: (mapLayer) => set({ mapLayer }),
}));
