import type { School } from '../../types/school';
import {
    MIN_SEARCH_LENGTH,
    normalizeSchoolSearchText,
    schoolMatchesQuery,
} from '../schoolSearch';

function makeSchool(overrides: Partial<School> = {}): School {
  return {
    id: 'school-1',
    name: "St. Joseph's High School",
    lat: 41.8,
    lng: -71.4,
    city: 'Providence',
    state: 'RI',
    numSpots: 2,
    type: 'k12_private',
    ...overrides,
  };
}

describe('MIN_SEARCH_LENGTH', () => {
  it('accepts 2-letter state codes', () => {
    expect(MIN_SEARCH_LENGTH).toBe(2);
  });
});

describe('normalizeSchoolSearchText', () => {
  it('strips punctuation and collapses spaces', () => {
    expect(normalizeSchoolSearchText("St. Joseph's")).toBe('st josephs');
  });
});

describe('schoolMatchesQuery', () => {
  it('matches every school when the query is blank', () => {
    expect(schoolMatchesQuery(makeSchool(), '   ')).toBe(true);
  });

  it('matches a punctuation-stripped school name', () => {
    expect(schoolMatchesQuery(makeSchool(), 'st josephs')).toBe(true);
  });

  it('matches city and state', () => {
    expect(schoolMatchesQuery(makeSchool(), 'providence')).toBe(true);
    expect(schoolMatchesQuery(makeSchool(), 'ri')).toBe(true);
  });

  it('rejects unrelated queries', () => {
    expect(schoolMatchesQuery(makeSchool(), 'brown')).toBe(false);
  });
});
