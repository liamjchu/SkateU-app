import type { School } from '../../types/school';
import {
    MIN_SEARCH_LENGTH,
    normalizeSchoolSearchText,
    schoolMatchesQuery,
    schoolMatchesTypeFilter,
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

describe('schoolMatchesTypeFilter', () => {
  it('keeps every saved school for all and saved', () => {
    const k12 = makeSchool({ type: 'k12_public' });
    const college = makeSchool({ id: 'college-1', type: 'higher_ed' });

    expect(schoolMatchesTypeFilter(k12, 'all')).toBe(true);
    expect(schoolMatchesTypeFilter(college, 'saved')).toBe(true);
  });

  it('keeps only K-12 schools for the k12 filter', () => {
    expect(schoolMatchesTypeFilter(makeSchool({ type: 'k12_public' }), 'k12')).toBe(
      true
    );
    expect(
      schoolMatchesTypeFilter(makeSchool({ type: 'k12_private' }), 'k12')
    ).toBe(true);
    expect(schoolMatchesTypeFilter(makeSchool({ type: 'higher_ed' }), 'k12')).toBe(
      false
    );
  });

  it('keeps only colleges for the college filter', () => {
    expect(
      schoolMatchesTypeFilter(makeSchool({ type: 'higher_ed' }), 'college')
    ).toBe(true);
    expect(
      schoolMatchesTypeFilter(makeSchool({ type: 'k12_public' }), 'college')
    ).toBe(false);
  });

  it('hides schools with an unknown type from type pills', () => {
    const unknownType = makeSchool({ type: undefined });

    expect(schoolMatchesTypeFilter(unknownType, 'k12')).toBe(false);
    expect(schoolMatchesTypeFilter(unknownType, 'college')).toBe(false);
    expect(schoolMatchesTypeFilter(unknownType, 'all')).toBe(true);
  });
});
