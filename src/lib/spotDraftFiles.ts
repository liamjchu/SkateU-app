import { Platform } from 'react-native';
import type { SpotImageAsset } from '../types/spot';

const DRAFT_DIR_SEGMENT = 'spot-drafts';

function isNativeFileSystemAvailable(): boolean {
  return Platform.OS !== 'web';
}

export function isDraftDirectoryUri(uri: string, draftId: string): boolean {
  return uri.includes(`/${DRAFT_DIR_SEGMENT}/${draftId}/`);
}

function extensionForImage(image: SpotImageAsset): string {
  const mime = image.mimeType?.toLowerCase() ?? '';
  if (mime.includes('png')) {
    return 'png';
  }
  if (mime.includes('webp')) {
    return 'webp';
  }

  const fileNameMatch = image.fileName?.match(/\.([a-zA-Z0-9]+)$/);
  if (fileNameMatch) {
    return fileNameMatch[1].toLowerCase();
  }

  const uriMatch = image.uri.match(/\.([a-zA-Z0-9]+)(?:\?|$)/);
  if (uriMatch) {
    return uriMatch[1].toLowerCase();
  }

  return 'jpg';
}

async function loadLegacyFileSystem() {
  return import('expo-file-system/legacy');
}

export async function filterExistingDraftImages(
  images: SpotImageAsset[]
): Promise<SpotImageAsset[]> {
  if (!isNativeFileSystemAvailable() || images.length === 0) {
    return images;
  }

  try {
    const FileSystem = await loadLegacyFileSystem();
    const kept: SpotImageAsset[] = [];

    for (const image of images) {
      const info = await FileSystem.getInfoAsync(image.uri);
      if (info.exists) {
        kept.push(image);
      }
    }

    return kept;
  } catch {
    return images;
  }
}

export async function copyDraftImages(
  draftId: string,
  images: SpotImageAsset[]
): Promise<SpotImageAsset[]> {
  if (!isNativeFileSystemAvailable() || images.length === 0) {
    return images;
  }

  try {
    const FileSystem = await loadLegacyFileSystem();
    const documentDirectory = FileSystem.documentDirectory;
    if (!documentDirectory) {
      return images;
    }

    const dir = `${documentDirectory}${DRAFT_DIR_SEGMENT}/${draftId}/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

    const copied: SpotImageAsset[] = [];
    const keepUris = new Set<string>();

    for (const image of images) {
      if (isDraftDirectoryUri(image.uri, draftId)) {
        const info = await FileSystem.getInfoAsync(image.uri);
        if (info.exists) {
          copied.push(image);
          keepUris.add(image.uri);
        }
        continue;
      }

      const dest = `${dir}${copied.length}-${Date.now().toString(36)}.${extensionForImage(image)}`;
      try {
        const sourceInfo = await FileSystem.getInfoAsync(image.uri);
        if (!sourceInfo.exists) {
          continue;
        }

        await FileSystem.copyAsync({ from: image.uri, to: dest });
        const nextImage: SpotImageAsset = {
          uri: dest,
          fileName: image.fileName,
          mimeType: image.mimeType,
        };
        copied.push(nextImage);
        keepUris.add(dest);
      } catch {
        copied.push(image);
      }
    }

    try {
      const listing = await FileSystem.readDirectoryAsync(dir);
      await Promise.all(
        listing.map(async (name) => {
          const uri = `${dir}${name}`;
          if (!keepUris.has(uri)) {
            await FileSystem.deleteAsync(uri, { idempotent: true });
          }
        })
      );
    } catch {
      // Directory listing is best-effort cleanup.
    }

    return copied;
  } catch {
    return images;
  }
}

export async function deleteDraftFiles(draftId: string): Promise<void> {
  if (!isNativeFileSystemAvailable()) {
    return;
  }

  try {
    const FileSystem = await loadLegacyFileSystem();
    const documentDirectory = FileSystem.documentDirectory;
    if (!documentDirectory) {
      return;
    }

    await FileSystem.deleteAsync(
      `${documentDirectory}${DRAFT_DIR_SEGMENT}/${draftId}`,
      { idempotent: true }
    );
  } catch {
    // Missing folders are fine; drafts should still leave the store.
  }
}
