import { File, Paths } from 'expo-file-system';
import type { StateStorage } from 'zustand/middleware';

// zustand persistence backed by a JSON file per store in the document
// directory. The new expo-file-system API is synchronous, which satisfies
// StateStorage (getItem may return a plain string).
function storeFile(name: string): File {
  return new File(Paths.document, `${name}.json`);
}

export const fileStorage: StateStorage = {
  getItem: (name) => {
    const file = storeFile(name);
    if (!file.exists) return null;
    try {
      return file.textSync();
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    const file = storeFile(name);
    if (file.exists) file.delete();
    file.create();
    file.write(value);
  },
  removeItem: (name) => {
    const file = storeFile(name);
    if (file.exists) file.delete();
  },
};
