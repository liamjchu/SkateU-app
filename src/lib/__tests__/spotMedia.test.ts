import {
    buildImageOrder,
    existingMediaItems,
    mediaListsEqual,
    spotMediaUri,
} from '../spotMedia';
import type { SpotMediaItem } from '../../types/spot';

describe('spotMedia helpers', () => {
  it('builds imageOrder with existing URLs and dense new indexes', () => {
    const items: SpotMediaItem[] = [
      { kind: 'existing', uri: 'https://img/a.jpg' },
      { kind: 'new', asset: { uri: 'file:///b.jpg', fileName: 'b.jpg' } },
      { kind: 'existing', uri: 'https://img/c.jpg' },
      { kind: 'new', asset: { uri: 'file:///d.jpg' } },
    ];

    expect(buildImageOrder(items)).toEqual({
      imageOrder: [
        { kind: 'existing', url: 'https://img/a.jpg' },
        { kind: 'new', index: 0 },
        { kind: 'existing', url: 'https://img/c.jpg' },
        { kind: 'new', index: 1 },
      ],
      newAssets: [
        { uri: 'file:///b.jpg', fileName: 'b.jpg' },
        { uri: 'file:///d.jpg' },
      ],
    });
  });

  it('treats cover reorder as a media change', () => {
    const original = existingMediaItems([
      'https://img/a.jpg',
      'https://img/b.jpg',
    ]);
    const reordered: SpotMediaItem[] = [original[1], original[0]];
    expect(mediaListsEqual(original, reordered)).toBe(false);
    expect(mediaListsEqual(original, existingMediaItems(['https://img/a.jpg', 'https://img/b.jpg']))).toBe(
      true
    );
  });

  it('compares mixed media lists and reads the display uri', () => {
    const existing: SpotMediaItem = { kind: 'existing', uri: 'https://img/a.jpg' };
    const next: SpotMediaItem = { kind: 'new', asset: { uri: 'file:///b.jpg' } };
    expect(spotMediaUri(existing)).toBe('https://img/a.jpg');
    expect(spotMediaUri(next)).toBe('file:///b.jpg');
    expect(existingMediaItems(['', 'https://img/a.jpg'])).toEqual([existing]);
    expect(mediaListsEqual([existing], [])).toBe(false);
    expect(mediaListsEqual([existing], [next])).toBe(false);
    expect(mediaListsEqual([next], [next])).toBe(true);
    expect(
      mediaListsEqual([next], [{ kind: 'new', asset: { uri: 'file:///other.jpg' } }])
    ).toBe(false);
  });
});
