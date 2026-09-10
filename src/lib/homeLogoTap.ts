export const HOME_LOGO_SCROLLED_OFFSET = 16;

export type HomeLogoTapAction = 'scroll-to-top' | 'refresh';

export function isHomeFeedScrolled(offset: number): boolean {
  return offset > HOME_LOGO_SCROLLED_OFFSET;
}

export function getHomeLogoTapAction(options: {
  isScrolled: boolean;
}): HomeLogoTapAction {
  if (options.isScrolled) {
    return 'scroll-to-top';
  }

  return 'refresh';
}

export function getHomeLogoTapHint(action: HomeLogoTapAction): string {
  switch (action) {
    case 'scroll-to-top':
      return 'Scrolls to the top of home';
    case 'refresh':
      return 'Refreshes the home feed';
  }
}
