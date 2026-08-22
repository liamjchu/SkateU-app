import { Platform } from 'react-native';
import {
  copyDraftImages,
  deleteDraftFiles,
  filterExistingDraftImages,
  isDraftDirectoryUri,
} from '../spotDraftFiles';
import type { SpotImageAsset } from '../../types/spot';

const platformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');

function image(uri: string): SpotImageAsset {
  return { uri };
}

afterEach(() => {
  if (platformDescriptor) {
    Object.defineProperty(Platform, 'OS', platformDescriptor);
  }
});

describe('isDraftDirectoryUri', () => {
  it('matches files stored under the draft folder', () => {
    expect(
      isDraftDirectoryUri('file:///docs/spot-drafts/draft-1/0.jpg', 'draft-1')
    ).toBe(true);
    expect(isDraftDirectoryUri('file:///cache/photo.jpg', 'draft-1')).toBe(false);
  });
});

describe('draft file helpers on web', () => {
  it('leave the image list and folders unchanged', async () => {
    Object.defineProperty(Platform, 'OS', { configurable: true, value: 'web' });
    const images = [image('https://cdn.example/a.jpg')];

    await expect(filterExistingDraftImages(images)).resolves.toEqual(images);
    await expect(copyDraftImages('draft-1', images)).resolves.toEqual(images);
    await expect(copyDraftImages('draft-1', [])).resolves.toEqual([]);
    await expect(deleteDraftFiles('draft-1')).resolves.toBeUndefined();
  });
});
