import { applyBlockedUserFilter } from '../blockedUsers';

describe('applyBlockedUserFilter', () => {
  it('does nothing when nobody is blocked', () => {
    const query = new URL('https://project.supabase.co/rest/v1/spots');
    applyBlockedUserFilter(query, 'created_by_user_id', []);
    expect(query.searchParams.get('or')).toBeNull();
  });

  it('keeps null creators and excludes blocked ids', () => {
    const query = new URL('https://project.supabase.co/rest/v1/spots');
    applyBlockedUserFilter(query, 'created_by_user_id', [
      'user-1',
      'user-2',
    ]);
    expect(query.searchParams.get('or')).toBe(
      '(created_by_user_id.is.null,created_by_user_id.not.in.(user-1,user-2))'
    );
  });
});
