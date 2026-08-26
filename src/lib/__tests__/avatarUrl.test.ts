import {
  avatarStorageKeyFromUrl,
  displayableAvatarUrl,
  isSkateUAvatarUrl,
} from '../avatarUrl';

describe('avatarUrl helpers', () => {
  const skateU =
    'https://project.supabase.co/storage/v1/object/public/avatars/user-1/pic.jpg';

  it('accepts only public avatars-bucket URLs', () => {
    expect(isSkateUAvatarUrl(skateU)).toBe(true);
    expect(displayableAvatarUrl(skateU)).toBe(skateU);
    expect(
      displayableAvatarUrl('https://lh3.googleusercontent.com/photo.jpg')
    ).toBeNull();
    expect(
      displayableAvatarUrl(
        'https://project.supabase.co/storage/v1/object/public/spot-images/a.jpg'
      )
    ).toBeNull();
    expect(displayableAvatarUrl(null)).toBeNull();
    expect(isSkateUAvatarUrl('not a url')).toBe(false);
  });

  it('reads the storage object key from a public avatar URL', () => {
    expect(avatarStorageKeyFromUrl(skateU)).toBe('user-1/pic.jpg');
    expect(avatarStorageKeyFromUrl('https://example.com/pic.jpg')).toBeNull();
  });
});
