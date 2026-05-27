import { File } from 'expo-file-system';
import type { Chunk, DocumentManifest } from '../../types';
import { stableHash } from '../../utils';
import { clearDocumentCache, documentCacheDir } from './audioCache';
import { buildChunks } from './textChunker';

const MANIFEST = 'manifest.json';

// Bump when buildChunks/chunkText changes shape or granularity so stored
// manifests (and their now-stale cached audio) are rebuilt on next open.
const CHUNKER_VERSION = 3;

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
// Reuses stored chunk boundaries only when both docHash AND the source text are
// unchanged, so chunkIdx/charStart stay aligned with the rendered sentences and
// cached audio. A re-extraction (e.g. an extractor-version bump) changes the
// text, which invalidates the old offsets — rebuild and drop the now-stale
// audio, otherwise a new chunk whose charStart collides with an old one (chunk
// 0 always starts at 0) would replay the wrong cached WAV.
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
