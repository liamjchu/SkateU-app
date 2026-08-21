export const HOME_LOGO_SCROLLED_OFFSET = 16;

export type HomeLogoTapAction = 'exit-search' | 'scroll-to-top' | 'refresh';

export function isHomeFeedScrolled(offset: number): boolean {
  return offset > HOME_LOGO_SCROLLED_OFFSET;
}

export function getHomeLogoTapAction(options: {
  isSearchMode: boolean;
  isScrolled: boolean;
}): HomeLogoTapAction {
  if (options.isSearchMode) {
    return 'exit-search';
  }

  if (options.isScrolled) {
    return 'scroll-to-top';
  }

  return 'refresh';
}

export function getHomeLogoTapHint(action: HomeLogoTapAction): string {
  switch (action) {
    case 'exit-search':
      return 'Cancels search and shows the home feed';
    case 'scroll-to-top':
      return 'Scrolls to the top of home';
    case 'refresh':
      return 'Refreshes the home feed';
  }
}
