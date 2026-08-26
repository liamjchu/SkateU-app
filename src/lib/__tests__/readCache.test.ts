import {
  capNewest,
  isRecord,
  parseBlockedUsers,
  parsePersistedSpotComments,
  parseProfile,
  parseSchool,
  parseSchoolFilter,
  parseSchools,
  parseSpot,
  parseSpots,
  readPersistedRecord,
} from '../readCache';
import { COMMENT_PAGE_SIZE } from '../commentForm';

const school = {
  id: 'school-1',
  name: 'Skate U',
  lat: 40,
  lng: -74,
  city: 'New York',
  state: 'NY',
  numSpots: 3,
};

const spot = {
  id: 'spot-1',
  name: 'Ledge',
  description: 'Granite',
  latitude: 40,
  longitude: -105,
  imageUris: ['https://example.com/a.jpg'],
  city: 'Boulder',
  state: 'CO',
  schoolName: 'CU',
  creatorUsername: 'jane',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  likedByUser: true,
  likeCount: 4,
};

describe('readCache helpers', () => {
  it('treats only plain objects as records', () => {
    expect(isRecord({ id: '1' })).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord(['x'])).toBe(false);
    expect(readPersistedRecord({ schools: [] })).toEqual({ schools: [] });
    expect(readPersistedRecord('nope')).toEqual({});
    expect(capNewest([1, 2, 3], 2)).toEqual([1, 2]);
    expect(capNewest([1, 2, 3], -4)).toEqual([]);
  });
});

describe('readCache parsers', () => {
  it('parses a school and rejects incomplete records', () => {
    expect(
      parseSchool({
        ...school,
        type: 'higher_ed',
        spotImageUrl: 'https://example.com/a.jpg',
      })
    ).toMatchObject({ id: 'school-1', type: 'higher_ed' });
    expect(parseSchool({ id: 'school-1' })).toBeNull();
    expect(parseSchool(null)).toBeNull();
    expect(parseSchool({ ...school, id: '' })).toBeNull();
    expect(parseSchool({ ...school, type: 'unknown', spotImageUrl: null })).toEqual(
      expect.objectContaining({ id: 'school-1', spotImageUrl: null })
    );
    expect(parseSchools(null)).toEqual([]);
    expect(parseSchools([{ ...school }, { id: 1 }])).toHaveLength(1);
    expect(parseSchoolFilter('college')).toBe('college');
    expect(parseSchoolFilter('nope')).toBeNull();
    expect(parseSchoolFilter(3)).toBeNull();
  });

  it('parses spots and skips invalid entries', () => {
    expect(parseSpot(spot)).toMatchObject({
      id: 'spot-1',
      likedByUser: true,
      likeCount: 4,
    });
    expect(parseSpot(null)).toBeNull();
    expect(parseSpot({ ...spot, id: '' })).toBeNull();
    expect(
      parseSpot({
        ...spot,
        schoolId: 'school-1',
        creatorUsername: null,
        creatorUserId: null,
        commentCount: 8,
        imageUris: ['ok', 2],
      })
    ).toMatchObject({
      schoolId: 'school-1',
      creatorUsername: null,
      creatorUserId: null,
      commentCount: 8,
      imageUris: ['ok'],
    });
    expect(parseSpot({ ...spot, likedByUser: 'yes' })).not.toHaveProperty(
      'likedByUser'
    );
    expect(parseSpots(null)).toEqual([]);
    expect(parseSpots([spot, { id: 1 }])).toHaveLength(1);
  });

  it('parses persisted comments including replies and pagination fallbacks', () => {
    expect(parsePersistedSpotComments(null)).toBeNull();
    expect(parsePersistedSpotComments({ comments: 'nope' })).toEqual({
      comments: [],
      hasMore: false,
      nextOffset: 0,
      commentCount: 0,
    });

    const parsed = parsePersistedSpotComments({
      comments: [
        {
          id: 'comment-1',
          spotId: 'spot-1',
          content: 'Nice',
          createdAt: '2024-01-01T00:00:00.000Z',
          userId: 'user-1',
          parentCommentId: null,
          creatorUsername: 'liam',
          replies: [
            {
              id: 'reply-1',
              spotId: 'spot-1',
              content: 'Agreed',
              createdAt: '2024-01-01T00:00:01.000Z',
              userId: null,
              parentCommentId: 'comment-1',
              creatorUsername: null,
            },
            { id: '' },
          ],
        },
        { id: 2 },
      ],
      hasMore: true,
      nextOffset: 40,
      commentCount: -3,
    });
    expect(parsed?.comments).toHaveLength(1);
    expect(parsed?.comments[0]?.replies).toHaveLength(1);
    expect(parsed?.hasMore).toBe(true);
    expect(parsed?.nextOffset).toBe(COMMENT_PAGE_SIZE);
    expect(parsed?.commentCount).toBe(0);

    const page = Array.from({ length: COMMENT_PAGE_SIZE }, (_, index) => ({
      id: `comment-${index}`,
      spotId: 'spot-1',
      content: 'x',
      createdAt: '2024-01-01T00:00:00.000Z',
    }));
    const filled = parsePersistedSpotComments({ comments: page });
    expect(filled?.hasMore).toBe(true);
    expect(filled?.nextOffset).toBe(COMMENT_PAGE_SIZE);
    expect(filled?.commentCount).toBe(COMMENT_PAGE_SIZE);
  });

  it('parses profiles and blocked users', () => {
    expect(
      parseProfile({
        id: 'user-1',
        username: 'liam',
        avatar_url: null,
        updated_at: null,
        legal_version: '2026-08-20',
        legal_accepted_at: null,
        age_attested_at: null,
      })
    ).toMatchObject({ id: 'user-1', username: 'liam' });
    expect(parseProfile({})).toBeNull();
    expect(parseProfile(null)).toBeNull();
    expect(parseProfile({ id: '', username: 'x' })).toBeNull();
    expect(
      parseBlockedUsers([
        { userId: 'blocked-1', username: 'x' },
        { username: 'nope' },
        null,
        { userId: '' },
      ])
    ).toEqual([{ userId: 'blocked-1', username: 'x' }]);
    expect(parseBlockedUsers(null)).toEqual([]);
  });
});
