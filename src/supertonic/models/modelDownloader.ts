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

  // Fixed denominator: the combined expected size of every file. Using a stable
  // total (rather than only the files seen so far) keeps overall progress
  // monotonic so the bar fills once, not once per file. minBytes is a slight
  // under-estimate, so we clamp the result to 1.
  const expectedTotal = assets.reduce((sum, a) => sum + a.minBytes, 0) || 1;
  // Expected bytes of files already finished/skipped this run.
  let completedShare = 0;
  const overallFor = (current: number) => Math.min(1, (completedShare + current) / expectedTotal);

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    const file = new File(dir, asset.name);

    if (file.exists && file.size >= asset.minBytes) {
      completedShare += asset.minBytes;
      onProgress?.({ file: asset.name, index: i + 1, total: assets.length, bytesWritten: file.size, totalBytes: file.size, overall: overallFor(0) });
      continue;
    }

    try {
      await File.downloadFileAsync(asset.url, file, {
        idempotent: true,
        onProgress: ({ bytesWritten, totalBytes }) => {
          // This file's share of the total, scaled by how far it has downloaded.
          const fileShare = totalBytes > 0 ? (bytesWritten / totalBytes) * asset.minBytes : 0;
          onProgress?.({ file: asset.name, index: i + 1, total: assets.length, bytesWritten, totalBytes, overall: overallFor(fileShare) });
        },
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

    completedShare += asset.minBytes;
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
