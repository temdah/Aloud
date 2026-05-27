import { File } from 'expo-file-system';
import { buildAssetList } from './modelCatalog';
import { modelDirectory } from './modelStorage';
import type { ModelDownloadProgress } from './modelTypes';

// Ensures all files for a model build + voice are present on device,
// downloading any that are missing or incomplete. Safe to call on every launch.
export async function ensureModelsDownloaded(
  modelId: string,
  voice: string,
  onProgress?: ModelDownloadProgress,
): Promise<void> {
  const dir = modelDirectory(modelId);
  const assets = buildAssetList(modelId, voice);

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    const file = new File(dir, asset.name);

    if (file.exists && file.size >= asset.minBytes) {
      onProgress?.({ file: asset.name, index: i + 1, total: assets.length, bytesWritten: file.size, totalBytes: file.size });
      continue;
    }

    try {
      await File.downloadFileAsync(asset.url, file, {
        idempotent: true,
        onProgress: ({ bytesWritten, totalBytes }) =>
          onProgress?.({ file: asset.name, index: i + 1, total: assets.length, bytesWritten, totalBytes }),
      });
    } catch (error) {
      // Remove any partial file so it isn't mistaken for complete next launch.
      try {
        if (file.exists) file.delete();
      } catch {}
      throw error;
    }

    if (!file.exists || file.size < asset.minBytes) {
      throw new Error(`Downloaded ${asset.name} looks incomplete (${file.exists ? file.size : 0} bytes)`);
    }
  }
}

// True if every file for a model build + voice is already present on device.
export function areModelsDownloaded(modelId: string, voice: string): boolean {
  const dir = modelDirectory(modelId);
  return buildAssetList(modelId, voice).every((asset) => {
    const file = new File(dir, asset.name);
    return file.exists && file.size >= asset.minBytes;
  });
}
