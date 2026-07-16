import { Directory, File, Paths } from 'expo-file-system';

const MODEL_ROOT = 'supertonic';

// The on-device directory where a model build's files live, namespaced per
// modelId so multiple builds (v2, v3) coexist without same-named files
// colliding. Created if missing.
export function modelDirectory(modelId: string): Directory {
  const dir = new Directory(Paths.document, MODEL_ROOT, modelId);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

export function modelFile(modelId: string, name: string): File {
  return new File(modelDirectory(modelId), name);
}

// Exact byte sizes (server Content-Length) recorded per file at download time,
// so completeness can be checked by identity rather than the `>= minBytes` floor
// (a download truncated past the floor otherwise passes as "complete").
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

/** Merge-record exact sizes for freshly downloaded files. Non-fatal on failure. */
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

// Deletes a model build's downloaded files to free storage. Safe if absent.
export function deleteModel(modelId: string): void {
  const dir = new Directory(Paths.document, MODEL_ROOT, modelId);
  if (dir.exists) dir.delete();
}

// onnxruntime-react-native expects a plain filesystem path, not a file:// URI.
export function ortModelPath(modelId: string, name: string): string {
  return modelFile(modelId, name).uri.replace(/^file:\/\//, '');
}
