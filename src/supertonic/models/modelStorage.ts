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

// Deletes a model build's downloaded files to free storage. Safe if absent.
export function deleteModel(modelId: string): void {
  const dir = new Directory(Paths.document, MODEL_ROOT, modelId);
  if (dir.exists) dir.delete();
}

// onnxruntime-react-native expects a plain filesystem path, not a file:// URI.
export function ortModelPath(modelId: string, name: string): string {
  return modelFile(modelId, name).uri.replace(/^file:\/\//, '');
}
