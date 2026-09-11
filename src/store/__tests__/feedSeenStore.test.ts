jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { useFeedSeenStore } from '../feedSeenStore';

beforeEach(() => {
  useFeedSeenStore.setState({
    seenSpotIds: [],
    hasHydrated: false,
  });
});

describe('feedSeenStore', () => {
  it('records seen spots in recency order', () => {
    useFeedSeenStore.getState().markSeen('a');
    useFeedSeenStore.getState().markSeen('b');
    useFeedSeenStore.getState().markSeen('a');
    expect(useFeedSeenStore.getState().seenSpotIds).toEqual(['b', 'a']);
  });

  it('merges persisted ids', () => {
    const merge = useFeedSeenStore.persist.getOptions().merge;
    expect(merge).toBeDefined();
    const merged = merge!(
      { seenSpotIds: ['spot-1', 2, 'spot-1', 'spot-2'] },
      useFeedSeenStore.getState()
    );
    expect(merged.seenSpotIds).toEqual(['spot-1', 'spot-2']);
  });
});
