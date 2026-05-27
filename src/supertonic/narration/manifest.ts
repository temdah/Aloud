import { File } from 'expo-file-system';
import type { Chunk, DocumentManifest } from '../../types';
import { documentCacheDir } from './audioCache';
import { buildChunks } from './textChunker';

const MANIFEST = 'manifest.json';

export function readManifest(docHash: string): DocumentManifest | null {
  const file = new File(documentCacheDir(docHash), MANIFEST);
  if (!file.exists) return null;
  try {
    return JSON.parse(file.textSync()) as DocumentManifest;
  } catch {
    return null;
  }
}

export function writeManifest(manifest: DocumentManifest): void {
  const file = new File(documentCacheDir(manifest.docHash), MANIFEST);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(manifest));
}

// The persisted chunk list for a document, built + persisted on first open.
// Reuses stored chunk boundaries when docHash matches, so chunkIdx/charStart
// never silently drift away from cached audio (§7.1 — never re-chunk silently).
export function loadChunks(docHash: string, text: string): Chunk[] {
  const existing = readManifest(docHash);
  if (existing?.docHash === docHash && existing.chunks.length > 0) return existing.chunks;
  const chunks = buildChunks(text);
  writeManifest({ docHash, chunks });
  return chunks;
}
