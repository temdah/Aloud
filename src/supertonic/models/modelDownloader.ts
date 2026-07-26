import { File } from 'expo-file-system';
import { buildAssetList } from './modelCatalog';
import { modelDirectory, readModelSizes, recordModelSizes } from './modelStorage';
import type { ModelAsset, ModelDownloadProgress } from './modelTypes';

// Downloads a model build's files (with progress) and verifies them against
// recorded sizes, re-downloading anything missing or incomplete.

// Complete = matches its recorded exact size, or (legacy, no record) the minBytes floor.
function isComplete(file: File, asset: ModelAsset, recorded: Record<string, number>): boolean {
  if (!file.exists) return false;
  const exact = recorded[asset.name];
  return exact != null ? file.size === exact : file.size >= asset.minBytes;
}

export async function ensureModelsDownloaded(
  modelId: string,
  voice: string,
  onProgress?: ModelDownloadProgress,
): Promise<void> {
  const dir = modelDirectory(modelId);
  const assets = buildAssetList(modelId, voice);
  const recorded = readModelSizes(modelId);
  const freshSizes: Record<string, number> = {};

  // Fixed denominator (sum of expected sizes) so overall progress climbs to 1
  // once, not once per file.
  const expectedTotal = assets.reduce((sum, a) => sum + a.minBytes, 0) || 1;
  let completedShare = 0;
  const overallFor = (current: number) => Math.min(1, (completedShare + current) / expectedTotal);

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i];
    const file = new File(dir, asset.name);

    if (isComplete(file, asset, recorded)) {
      completedShare += asset.minBytes;
      onProgress?.({ file: asset.name, index: i + 1, total: assets.length, bytesWritten: file.size, totalBytes: file.size, overall: overallFor(0) });
      continue;
    }

    let contentLength = 0;
    try {
      await File.downloadFileAsync(asset.url, file, {
        idempotent: true,
        onProgress: ({ bytesWritten, totalBytes }) => {
          if (totalBytes > 0) contentLength = totalBytes;
          const fileShare = totalBytes > 0 ? (bytesWritten / totalBytes) * asset.minBytes : 0;
          onProgress?.({ file: asset.name, index: i + 1, total: assets.length, bytesWritten, totalBytes, overall: overallFor(fileShare) });
        },
      });
    } catch (error) {
      try {
        if (file.exists) file.delete();
      } catch {}
      throw error;
    }

    // Verify against the server Content-Length to catch truncation past the floor.
    if (contentLength > 0 && file.exists && file.size !== contentLength) {
      try {
        file.delete();
      } catch {}
      throw new Error(`Downloaded ${asset.name} is truncated (${file.size} of ${contentLength} bytes)`);
    }
    if (!file.exists || file.size < asset.minBytes) {
      throw new Error(`Downloaded ${asset.name} looks incomplete (${file.exists ? file.size : 0} bytes)`);
    }

    if (contentLength > 0) freshSizes[asset.name] = contentLength;
    completedShare += asset.minBytes;
  }

  if (Object.keys(freshSizes).length > 0) recordModelSizes(modelId, freshSizes);
}

export function areModelsDownloaded(modelId: string, voice: string): boolean {
  const dir = modelDirectory(modelId);
  const recorded = readModelSizes(modelId);
  return buildAssetList(modelId, voice).every((asset) => isComplete(new File(dir, asset.name), asset, recorded));
}
