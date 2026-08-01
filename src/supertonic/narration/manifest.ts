import { File } from 'expo-file-system';
import type { Chunk, DocumentManifest } from '../../types';
import { stableHash } from '../../utils';
import { clearDocumentCache, clearFragmentedCache, documentCacheDir } from './audioCache';
import { buildChunks } from './textChunker';

// Persisted per-document chunk list (manifest.json).

const MANIFEST = 'manifest.json';

// Bump when buildChunks/chunkText changes shape so stale manifests (and their
// now-stale audio) rebuild. v5: hard chunk cap with semantic fallback splits.
const CHUNKER_VERSION = 5;

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

// Reuse stored chunks only when docHash, text, chunker version, and unit length
// all match. On a mismatch, rebuild and clear stale audio: a text change makes
// ALL cached audio stale (full clear); a unit-length change (same text, different
// chunking) keeps any full audiobook and drops only the loose per-chunk cache.
export function loadChunks(docHash: string, text: string, unitLen: number): Chunk[] {
  const textHash = stableHash(text);
  const existing = readManifest(docHash);
  if (
    existing?.docHash === docHash &&
    existing.textHash === textHash &&
    existing.chunkerVersion === CHUNKER_VERSION &&
    (existing.unitLen ?? 300) === unitLen &&
    existing.chunks.length > 0
  ) {
    return existing.chunks;
  }
  if (existing) {
    if (existing.textHash !== textHash) clearDocumentCache(docHash);
    else clearFragmentedCache(docHash);
  }
  const chunks = buildChunks(text, unitLen);
  writeManifest({ docHash, textHash, chunkerVersion: CHUNKER_VERSION, unitLen, chunks });
  return chunks;
}
