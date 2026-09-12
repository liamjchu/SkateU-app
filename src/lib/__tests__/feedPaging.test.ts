import { APP_TAB_BAR_CONTENT_HEIGHT } from '../tabBar';
import { feedPageHeight } from '../feedPaging';

describe('feedPageHeight', () => {
  it('fills the scene above the tab bar', () => {
    expect(feedPageHeight(800, 34)).toBe(800 - (APP_TAB_BAR_CONTENT_HEIGHT + 34));
    expect(feedPageHeight(100, 0)).toBe(100 - APP_TAB_BAR_CONTENT_HEIGHT);
  });
});
