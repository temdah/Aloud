import { Directory, File, Paths } from 'expo-file-system';

// On-device model file storage, namespaced per modelId so builds (v2, v3) coexist.

const MODEL_ROOT = 'supertonic';

export function modelDirectory(modelId: string): Directory {
  const dir = new Directory(Paths.document, MODEL_ROOT, modelId);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

export function modelFile(modelId: string, name: string): File {
  return new File(modelDirectory(modelId), name);
}

// Exact per-file sizes (Content-Length) recorded at download, so completeness is
// an identity check — a download truncated past the minBytes floor is caught.
const SIZES_FILE = 'sizes.json';

export function readModelSizes(modelId: string): Record<string, number> {
  const file = new File(modelDirectory(modelId), SIZES_FILE);
  if (!file.exists) return {};
  try {
    return JSON.parse(file.textSync()) as Record<string, number>;
  } catch {
    return {};
  }
}

export function recordModelSizes(modelId: string, sizes: Record<string, number>): void {
  const merged = { ...readModelSizes(modelId), ...sizes };
  const file = new File(modelDirectory(modelId), SIZES_FILE);
  try {
    if (file.exists) file.delete();
    file.create();
    file.write(JSON.stringify(merged));
  } catch {
    // Non-fatal: completeness checks fall back to the minBytes floor.
  }
}

export function deleteModel(modelId: string): void {
  const dir = new Directory(Paths.document, MODEL_ROOT, modelId);
  if (dir.exists) dir.delete();
}

// ORT wants a plain filesystem path, not a file:// URI.
export function ortModelPath(modelId: string, name: string): string {
  return modelFile(modelId, name).uri.replace(/^file:\/\//, '');
}
