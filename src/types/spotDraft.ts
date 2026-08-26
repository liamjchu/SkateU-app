import type { SpotImageAsset } from './spot';

export type SpotDraftStatus = 'draft' | 'submitting';

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
  status: SpotDraftStatus;
  lastError: string | null;
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
  status?: SpotDraftStatus;
  lastError?: string | null;
};
