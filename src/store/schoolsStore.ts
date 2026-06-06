import { create } from 'zustand';
import type { School } from '../types/school';

type SchoolsStore = {
  schools: School[];
  incrementSpotCount: (schoolId: string) => void;
  decrementSpotCount: (schoolId: string) => void;
};

const INITIAL_SCHOOLS: School[] = [
  { id: '1', name: 'Brown University', lat: 41.8268, lng: -71.4010, city: 'Providence', state: 'RI', numSpots: 0 },
  { id: '2', name: 'James W Robinson, Jr. Secondary School', lat: 38.8167, lng: -77.3025, city: 'Fairfax', state: 'VA', numSpots: 0 },
  { id: '3', name: 'Trinity Christian School', lat: 38.8339, lng: -77.3324, city: 'Fairfax', state: 'VA', numSpots: 0 },
  { id: '4', name: 'Bonnie Brae Elementary School', lat: 38.8035, lng: -77.3103, city: 'Fairfax', state: 'VA', numSpots: 0 },
];

export const useSchools = create<SchoolsStore>((set: (fn: (state: SchoolsStore) => SchoolsStore) => void) => ({
  schools: INITIAL_SCHOOLS,
  incrementSpotCount: (schoolId: string) => {
    set((state: SchoolsStore) => ({
      ...state,
      schools: state.schools.map((school: School) =>
        school.id === schoolId
          ? { ...school, numSpots: school.numSpots + 1 }
          : school
      ),
    }));
  },
  decrementSpotCount: (schoolId: string) => {
    set((state: SchoolsStore) => ({
      ...state,
      schools: state.schools.map((school: School) =>
        school.id === schoolId
          ? { ...school, numSpots: Math.max(0, school.numSpots - 1) }
          : school
      ),
    }));
  },
}));
