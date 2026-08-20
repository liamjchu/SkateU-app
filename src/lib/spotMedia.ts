import type { SpotImageAsset, SpotMediaItem } from '../types/spot';

export type ImageOrderEntry =
  | { kind: 'existing'; url: string }
  | { kind: 'new'; index: number };

export function spotMediaUri(item: SpotMediaItem): string {
  return item.kind === 'existing' ? item.uri : item.asset.uri;
}

export function existingMediaItems(uris: string[]): SpotMediaItem[] {
  return uris
    .filter((uri) => uri.length > 0)
    .map((uri) => ({ kind: 'existing', uri }));
}

export function mediaListsEqual(
  left: SpotMediaItem[],
  right: SpotMediaItem[]
): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => {
    const other = right[index];
    if (item.kind !== other.kind) {
      return false;
    }
    if (item.kind === 'existing' && other.kind === 'existing') {
      return item.uri === other.uri;
    }
    if (item.kind === 'new' && other.kind === 'new') {
      return item.asset.uri === other.asset.uri;
    }
    return false;
  });
}

export function buildImageOrder(items: SpotMediaItem[]): {
  imageOrder: ImageOrderEntry[];
  newAssets: SpotImageAsset[];
} {
  const newAssets: SpotImageAsset[] = [];
  const imageOrder: ImageOrderEntry[] = items.map((item) => {
    if (item.kind === 'existing') {
      return { kind: 'existing', url: item.uri };
    }

    const index = newAssets.length;
    newAssets.push(item.asset);
    return { kind: 'new', index };
  });

  return { imageOrder, newAssets };
}
