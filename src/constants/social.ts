export const SOCIAL_LINKS = [
  {
    id: 'instagram',
    label: 'Instagram',
    url: 'https://www.instagram.com/skateu.app/',
    accessibilityLabel: 'Follow SkateU on Instagram',
  },
  {
    id: 'tiktok',
    label: 'TikTok',
    url: 'https://www.tiktok.com/@skateu.app',
    accessibilityLabel: 'Follow SkateU on TikTok',
  },
  {
    id: 'youtube',
    label: 'YouTube',
    url: 'https://www.youtube.com/@liam_chu',
    accessibilityLabel: 'Follow SkateU on YouTube',
  },
] as const;

export type SocialLink = (typeof SOCIAL_LINKS)[number];
export type SocialPlatformId = SocialLink['id'];
