import type { School } from '../types/school';

// Matches GET /api/schools and search_schools. Two characters lets "RI" work.
export const MIN_SEARCH_LENGTH = 2;


// Strips punctuation so "st josephs" matches "St. Joseph's".
export function normalizeSchoolSearchText(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function schoolMatchesQuery(school: School, query: string) {
  const trimmedQuery = normalizeSchoolSearchText(query);

  if (trimmedQuery.length === 0) {
    return true;
  }

  return (
    normalizeSchoolSearchText(school.name).includes(trimmedQuery) ||
    normalizeSchoolSearchText(school.city).includes(trimmedQuery) ||
    normalizeSchoolSearchText(school.state).includes(trimmedQuery)
  );
}
