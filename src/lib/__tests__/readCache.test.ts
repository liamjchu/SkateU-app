import {
  parseSchool,
  parseSpot,
  parseSpots,
  parseProfile,
  parseBlockedUsers,
} from '../readCache';

describe('readCache parsers', () => {
  it('parses a school and rejects incomplete records', () => {
    expect(
      parseSchool({
        id: 'school-1',
        name: 'Skate U',
        lat: 40,
        lng: -74,
        city: 'New York',
        state: 'NY',
        numSpots: 3,
        type: 'higher_ed',
        spotImageUrl: 'https://example.com/a.jpg',
      })
    ).toMatchObject({ id: 'school-1', type: 'higher_ed' });
    expect(parseSchool({ id: 'school-1' })).toBeNull();
  });

  it('parses spots and skips invalid entries', () => {
    const spot = parseSpot({
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
    });
    expect(spot).toMatchObject({ id: 'spot-1', likedByUser: true, likeCount: 4 });
    expect(parseSpots([spot, { id: 1 }])).toHaveLength(1);
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
    expect(
      parseBlockedUsers([{ userId: 'blocked-1', username: 'x' }, { username: 'nope' }])
    ).toEqual([{ userId: 'blocked-1', username: 'x' }]);
  });
});
