import { File } from 'expo-file-system';
import { buildAssetList } from './modelCatalog';
import { modelDirectory, readModelSizes, recordModelSizes } from './modelStorage';
import type { ModelAsset, ModelDownloadProgress } from './modelTypes';

// A file is complete if it matches its recorded exact size (identity), or — for
// files downloaded before sizes were recorded — meets the minBytes floor.
function isComplete(file: File, asset: ModelAsset, recorded: Record<string, number>): boolean {
  if (!file.exists) return false;
  const exact = recorded[asset.name];
  return exact != null ? file.size === exact : file.size >= asset.minBytes;
}

// Ensures all files for a model build + voice are present on device,
// downloading any that are missing or incomplete. Safe to call on every launch.
export async function ensureModelsDownloaded(
  modelId: string,
  voice: string,
  onProgress?: ModelDownloadProgress,
): Promise<void> {
  const dir = modelDirectory(modelId);
  const assets = buildAssetList(modelId, voice);
  const recorded = readModelSizes(modelId);
  const freshSizes: Record<string, number> = {};

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

    if (isComplete(file, asset, recorded)) {
      completedShare += asset.minBytes;
      onProgress?.({ file: asset.name, index: i + 1, total: assets.length, bytesWritten: file.size, totalBytes: file.size, overall: overallFor(0) });
      continue;
    }

    // Capture the server's Content-Length (last non-zero totalBytes) to verify
    // the download landed whole and to record the exact size for future checks.
    let contentLength = 0;
    try {
      await File.downloadFileAsync(asset.url, file, {
        idempotent: true,
        onProgress: ({ bytesWritten, totalBytes }) => {
          if (totalBytes > 0) contentLength = totalBytes;
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

    // Exact-size check when the server reported a length (catches truncation past
    // the minBytes floor); otherwise fall back to the floor.
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

// True if every file for a model build + voice is already present + complete
// (exact recorded size when known, else the minBytes floor for legacy downloads).
export function areModelsDownloaded(modelId: string, voice: string): boolean {
  const dir = modelDirectory(modelId);
  const recorded = readModelSizes(modelId);
  return buildAssetList(modelId, voice).every((asset) => isComplete(new File(dir, asset.name), asset, recorded));
}
