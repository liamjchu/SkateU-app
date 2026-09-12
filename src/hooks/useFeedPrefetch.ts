import { useRef } from 'react';
import type { ViewToken } from 'react-native';
import { FEED_SEEN_VIEW_PERCENT } from '../lib/feedPaging';
import { shouldPrefetchMoreItems } from '../lib/homeFeed';

export function useFeedPrefetch(
  itemCount: number,
  loadMore: () => void,
  onVisibleItems?: (items: ViewToken[]) => void
) {
  const itemCountRef = useRef(itemCount);
  const loadMoreRef = useRef(loadMore);
  const onVisibleItemsRef = useRef(onVisibleItems);
  itemCountRef.current = itemCount;
  loadMoreRef.current = loadMore;
  onVisibleItemsRef.current = onVisibleItems;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      onVisibleItemsRef.current?.(viewableItems);

      const highestVisibleIndex = viewableItems.reduce((highest, token) => {
        if (typeof token.index === 'number' && token.index > highest) {
          return token.index;
        }
        return highest;
      }, -1);

      if (shouldPrefetchMoreItems(highestVisibleIndex, itemCountRef.current)) {
        loadMoreRef.current();
      }
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: FEED_SEEN_VIEW_PERCENT,
  }).current;

  return { onViewableItemsChanged, viewabilityConfig };
}
