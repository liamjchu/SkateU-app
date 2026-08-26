import { Platform } from 'react-native';
import {
  copyDraftImages,
  deleteDraftFiles,
  filterExistingDraftImages,
  isDraftDirectoryUri,
} from '../spotDraftFiles';
import type { SpotImageAsset } from '../../types/spot';

jest.mock('expo-file-system/legacy', () => ({
  __esModule: true,
  documentDirectory: 'file:///docs/',
  getInfoAsync: jest.fn(),
  makeDirectoryAsync: jest.fn(),
  copyAsync: jest.fn(),
  readDirectoryAsync: jest.fn(),
  deleteAsync: jest.fn(),
}));

import * as FileSystem from 'expo-file-system/legacy';

const fileSystem = FileSystem as unknown as {
  documentDirectory: string | null;
  getInfoAsync: jest.Mock;
  makeDirectoryAsync: jest.Mock;
  copyAsync: jest.Mock;
  readDirectoryAsync: jest.Mock;
  deleteAsync: jest.Mock;
};

const platformDescriptor = Object.getOwnPropertyDescriptor(Platform, 'OS');

function image(
  uri: string,
  extras: Partial<SpotImageAsset> = {}
): SpotImageAsset {
  return { uri, ...extras };
}

function nativePlatform(): void {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
}

afterEach(() => {
  jest.clearAllMocks();
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

describe('draft file helpers on native', () => {
  beforeEach(() => {
    nativePlatform();
    fileSystem.documentDirectory = 'file:///docs/';
    fileSystem.getInfoAsync.mockResolvedValue({ exists: true });
    fileSystem.makeDirectoryAsync.mockResolvedValue(undefined);
    fileSystem.copyAsync.mockResolvedValue(undefined);
    fileSystem.readDirectoryAsync.mockResolvedValue([]);
    fileSystem.deleteAsync.mockResolvedValue(undefined);
  });

  it('keeps only files that still exist', async () => {
    fileSystem.getInfoAsync
      .mockResolvedValueOnce({ exists: true })
      .mockResolvedValueOnce({ exists: false });

    await expect(
      filterExistingDraftImages([
        image('file:///cache/keep.jpg'),
        image('file:///cache/gone.jpg'),
      ])
    ).resolves.toEqual([image('file:///cache/keep.jpg')]);
  });

  it('returns the original list when existence checks fail', async () => {
    fileSystem.getInfoAsync.mockRejectedValue(new Error('fs'));
    const images = [image('file:///cache/a.jpg')];
    await expect(filterExistingDraftImages(images)).resolves.toEqual(images);
  });

  it('copies new photos and keeps existing draft files', async () => {
    const draftUri = 'file:///docs/spot-drafts/draft-1/kept.jpg';
    fileSystem.getInfoAsync.mockImplementation(async (uri: string) => ({
      exists: uri !== 'file:///cache/missing.jpg',
    }));
    fileSystem.readDirectoryAsync.mockResolvedValue([
      'kept.jpg',
      'stale.jpg',
    ]);

    const copied = await copyDraftImages('draft-1', [
      image(draftUri),
      image('file:///cache/missing.jpg'),
      image('file:///cache/photo.png', {
        fileName: 'photo.png',
        mimeType: 'image/png',
      }),
      image('file:///cache/photo.webp', { mimeType: 'image/webp' }),
      image('file:///cache/photo.JPEG', { fileName: 'photo.JPEG' }),
      image('file:///cache/no-ext?token=1'),
    ]);

    expect(copied.some((item) => item.uri === draftUri)).toBe(true);
    expect(copied.some((item) => item.uri.endsWith('.png'))).toBe(true);
    expect(copied.some((item) => item.uri.endsWith('.webp'))).toBe(true);
    expect(copied.some((item) => item.uri.endsWith('.jpeg'))).toBe(true);
    expect(copied.some((item) => item.uri.endsWith('.jpg'))).toBe(true);
    expect(fileSystem.copyAsync).toHaveBeenCalled();
    expect(fileSystem.deleteAsync).toHaveBeenCalledWith(
      'file:///docs/spot-drafts/draft-1/stale.jpg',
      { idempotent: true }
    );
  });

  it('keeps the original photo when a copy fails', async () => {
    fileSystem.copyAsync.mockRejectedValue(new Error('copy'));
    const original = image('file:///cache/photo.jpg', { mimeType: 'image/jpeg' });
    await expect(copyDraftImages('draft-1', [original])).resolves.toEqual([
      original,
    ]);
  });

  it('skips a draft file that no longer exists and ignores listing failures', async () => {
    fileSystem.getInfoAsync.mockResolvedValue({ exists: false });
    fileSystem.readDirectoryAsync.mockRejectedValue(
      new Error('missing dir')
    );

    await expect(
      copyDraftImages('draft-1', [
        image('file:///docs/spot-drafts/draft-1/gone.jpg'),
      ])
    ).resolves.toEqual([]);
  });

  it('leaves images unchanged when the document directory is missing', async () => {
    fileSystem.documentDirectory = null;
    const images = [image('file:///cache/a.jpg')];
    await expect(copyDraftImages('draft-1', images)).resolves.toEqual(images);
    await expect(deleteDraftFiles('draft-1')).resolves.toBeUndefined();
    expect(fileSystem.deleteAsync).not.toHaveBeenCalled();
  });

  it('deletes a draft folder and swallows missing-folder errors', async () => {
    await deleteDraftFiles('draft-1');
    expect(fileSystem.deleteAsync).toHaveBeenCalledWith(
      'file:///docs/spot-drafts/draft-1',
      { idempotent: true }
    );

    fileSystem.deleteAsync.mockRejectedValue(new Error('gone'));
    await expect(deleteDraftFiles('draft-1')).resolves.toBeUndefined();
  });

  it('returns the original images when copy setup fails', async () => {
    fileSystem.makeDirectoryAsync.mockRejectedValue(
      new Error('mkdir')
    );
    const images = [image('file:///cache/a.jpg')];
    await expect(copyDraftImages('draft-1', images)).resolves.toEqual(images);
  });
});
