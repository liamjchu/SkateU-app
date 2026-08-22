export const GUEST_BROWSE_TITLE = 'Browse as Guest';

export const GUEST_BROWSE_INTRO =
  'Explore SkateU without creating an account.';

export const GUEST_BROWSE_CAPABILITIES = [
  'Discover schools and skate spots',
  'View spot details',
  'Browse the feed',
  'Read comments',
] as const;

export const GUEST_BROWSE_CLOSING =
  'Create an account when you want to like spots, add your own, join the conversation, or report content.';

export function formatGuestBrowseMessage(): string {
  return `${GUEST_BROWSE_INTRO}\n\nYou can:\n${GUEST_BROWSE_CAPABILITIES.map(
    (item) => `• ${item}`
  ).join('\n')}\n\n${GUEST_BROWSE_CLOSING}`;
}
