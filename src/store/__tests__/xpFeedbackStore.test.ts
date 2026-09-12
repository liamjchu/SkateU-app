jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

import { useXpFeedbackStore } from '../xpFeedbackStore';

beforeEach(() => {
  useXpFeedbackStore.setState({
    lastSeenUserId: null,
    lastSeenXp: null,
    hasHydrated: true,
    toast: null,
    rankUp: null,
  });
});

describe('xpFeedbackStore', () => {
  it('hydrates the first snapshot without a toast', () => {
    useXpFeedbackStore.getState().applyXpSnapshot('user-1', 40);
    expect(useXpFeedbackStore.getState()).toMatchObject({
      lastSeenUserId: 'user-1',
      lastSeenXp: 40,
      toast: null,
      rankUp: null,
    });
  });

  it('toasts XP gains and rank-ups, and swallows losses', () => {
    useXpFeedbackStore.getState().applyXpSnapshot('user-1', 90);
    useXpFeedbackStore.getState().applyXpSnapshot('user-1', 95, 'like_received');
    expect(useXpFeedbackStore.getState().toast).toEqual({
      title: '+5 XP',
      message: 'New like',
    });

    useXpFeedbackStore.getState().applyXpSnapshot('user-1', 100);
    expect(useXpFeedbackStore.getState().rankUp).toEqual({ rank: 'shop_rider' });
    expect(useXpFeedbackStore.getState().toast).toBeNull();

    useXpFeedbackStore.getState().applyXpSnapshot('user-1', 80);
    expect(useXpFeedbackStore.getState()).toMatchObject({
      lastSeenXp: 80,
      toast: null,
      rankUp: { rank: 'shop_rider' },
    });
  });
});
