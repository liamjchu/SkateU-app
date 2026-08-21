import {
    getHomeLogoTapAction,
    getHomeLogoTapHint,
    HOME_LOGO_SCROLLED_OFFSET,
    isHomeFeedScrolled,
} from '../homeLogoTap';

describe('isHomeFeedScrolled', () => {
  it('treats small bounce as the top', () => {
    expect(isHomeFeedScrolled(0)).toBe(false);
    expect(isHomeFeedScrolled(HOME_LOGO_SCROLLED_OFFSET)).toBe(false);
  });

  it('treats anything past the threshold as scrolled', () => {
    expect(isHomeFeedScrolled(HOME_LOGO_SCROLLED_OFFSET + 1)).toBe(true);
  });
});

describe('getHomeLogoTapAction', () => {
  it('cancels search before scrolling or refreshing', () => {
    expect(
      getHomeLogoTapAction({ isSearchMode: true, isScrolled: true })
    ).toBe('exit-search');
    expect(
      getHomeLogoTapAction({ isSearchMode: true, isScrolled: false })
    ).toBe('exit-search');
  });

  it('scrolls to top when the feed is scrolled', () => {
    expect(
      getHomeLogoTapAction({ isSearchMode: false, isScrolled: true })
    ).toBe('scroll-to-top');
  });

  it('refreshes when already at the top', () => {
    expect(
      getHomeLogoTapAction({ isSearchMode: false, isScrolled: false })
    ).toBe('refresh');
  });
});

describe('getHomeLogoTapHint', () => {
  it('describes each action', () => {
    expect(getHomeLogoTapHint('exit-search')).toContain('Cancels search');
    expect(getHomeLogoTapHint('scroll-to-top')).toContain('top of home');
    expect(getHomeLogoTapHint('refresh')).toContain('Refreshes');
  });
});
