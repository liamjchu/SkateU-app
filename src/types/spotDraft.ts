import type { SpotImageAsset } from './spot';

export type SpotDraft = {
  id: string;
  userId: string;
  schoolId: string;
  schoolName: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  images: SpotImageAsset[];
  createdAt: string;
  updatedAt: string;
};

export type SpotDraftInput = {
  id?: string;
  userId: string;
  schoolId: string;
  schoolName: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  images: SpotImageAsset[];
};
