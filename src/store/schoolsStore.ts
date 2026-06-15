import { create } from 'zustand';
import type { School } from '../types/school';

type SchoolsStore = {
  schools: School[];
  upsertSchool: (school: School) => void;
};

function mergeSchools(schools: School[]) {
  const schoolMap = new Map<string, School>();

  schools.forEach((school) => schoolMap.set(school.id, school));

  return Array.from(schoolMap.values());
}

export const useSchools = create<SchoolsStore>()((set) => ({
  schools: [],
  upsertSchool: (school: School) => {
    set((state) => ({
      schools: mergeSchools([...state.schools, school]),
    }));
  },
}));
