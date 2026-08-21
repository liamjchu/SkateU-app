import { SOCIAL_LINKS } from '../../constants/social';
import { openSocialUrl } from '../socialLinks';

const mockOpenURL = jest.fn();
const mockAlert = jest.fn();

jest.mock('expo-linking', () => ({
  openURL: (url: string) => mockOpenURL(url),
}));

jest.mock('react-native', () => ({
  Alert: {
    alert: (...args: unknown[]) => mockAlert(...args),
  },
}));

describe('SOCIAL_LINKS', () => {
  it('lists Instagram, TikTok, and YouTube with the official SkateU URLs', () => {
    expect(
      SOCIAL_LINKS.map((link) => [link.label, link.url, link.accessibilityLabel])
    ).toEqual([
      [
        'Instagram',
        'https://www.instagram.com/skateu.app/',
        'Follow SkateU on Instagram',
      ],
      [
        'TikTok',
        'https://www.tiktok.com/@skateu.app',
        'Follow SkateU on TikTok',
      ],
      [
        'YouTube',
        'https://www.youtube.com/@liam_chu',
        'Follow SkateU on YouTube',
      ],
    ]);
  });
});

describe('openSocialUrl', () => {
  beforeEach(() => {
    mockOpenURL.mockReset();
    mockAlert.mockReset();
  });

  it('opens the social URL', async () => {
    mockOpenURL.mockResolvedValue(true);

    await openSocialUrl('https://www.instagram.com/skateu.app/');

    expect(mockOpenURL).toHaveBeenCalledWith(
      'https://www.instagram.com/skateu.app/'
    );
    expect(mockAlert).not.toHaveBeenCalled();
  });

  it('alerts when the URL cannot be opened', async () => {
    mockOpenURL.mockRejectedValue(new Error('unsupported'));

    await openSocialUrl('https://www.tiktok.com/@skateu.app');

    expect(mockAlert).toHaveBeenCalledWith(
      'Couldn’t open that link',
      'Please try again.'
    );
  });
});
