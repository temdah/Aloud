import { Directory, File, Paths } from 'expo-file-system';

const MODEL_SUBDIR = 'supertonic';

// The on-device directory where model files live. Created if missing.
export function modelDirectory(): Directory {
  const dir = new Directory(Paths.document, MODEL_SUBDIR);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

export function modelFile(name: string): File {
  return new File(modelDirectory(), name);
}

// onnxruntime-react-native expects a plain filesystem path, not a file:// URI.
export function ortModelPath(name: string): string {
  return modelFile(name).uri.replace(/^file:\/\//, '');
}
