import { File } from 'expo-file-system';
import type { Chunk, DocumentManifest } from '../../types';
import { stableHash } from '../../utils';
import { clearDocumentCache, documentCacheDir } from './audioCache';
import { buildChunks } from './textChunker';

// Persisted per-document chunk list (manifest.json).

const MANIFEST = 'manifest.json';

// Bump when buildChunks/chunkText changes shape so stale manifests (and their
// now-stale audio) rebuild. v4: CJK boundaries + language-aware chunk length.
const CHUNKER_VERSION = 4;

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

// Reuse stored chunks only when docHash, text, and chunker version all match. A
// re-extraction changes the text → rebuild and clear the old audio, else a new
// chunk 0 (charStart 0) would replay the previous cached clip.
export function loadChunks(docHash: string, text: string): Chunk[] {
  const textHash = stableHash(text);
  const existing = readManifest(docHash);
  if (
    existing?.docHash === docHash &&
    existing.textHash === textHash &&
    existing.chunkerVersion === CHUNKER_VERSION &&
    existing.chunks.length > 0
  ) {
    return existing.chunks;
  }
  if (existing) clearDocumentCache(docHash);
  const chunks = buildChunks(text);
  writeManifest({ docHash, textHash, chunkerVersion: CHUNKER_VERSION, chunks });
  return chunks;
}
