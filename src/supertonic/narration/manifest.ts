import { File } from 'expo-file-system';
import type { Chunk, DocumentManifest } from '../../types';
import { stableHash } from '../../utils/hash';
import { clearDocumentCache, clearFragmentedCache, documentCacheDir } from './audioCache';
import { createNarrationPlan } from './narrationPlan';
import type { NarrationPlan } from './narrationPlanTypes';
import { buildChunks } from './textChunker';

// Persisted per-document chunk list (manifest.json).

const MANIFEST = 'manifest.json';

// Bump when buildChunks/chunkText changes shape so stale manifests (and their
// now-stale audio) rebuild. v5: hard chunk cap with semantic fallback splits.
// v6: persisted stable sentence anchors. v7: low-latency capped anchors.
const CHUNKER_VERSION = 7;

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
export function loadNarrationPlan(docHash: string, text: string, unitLen: number): NarrationPlan {
  const textHash = stableHash(text);
  const existing = readManifest(docHash);
  if (
    existing?.docHash === docHash &&
    existing.textHash === textHash &&
    existing.chunkerVersion === CHUNKER_VERSION &&
    (existing.unitLen ?? 300) === unitLen &&
    existing.chunks.length > 0 &&
    existing.sentenceAnchors.length > 0
  ) {
    return { text, chunks: existing.chunks, sentences: existing.sentenceAnchors };
  }
  if (existing) {
    if (existing.textHash !== textHash) clearDocumentCache(docHash);
    else clearFragmentedCache(docHash);
  }
  const chunks = buildChunks(text, unitLen);
  const plan = createNarrationPlan(text, chunks);
  writeManifest({
    docHash,
    textHash,
    chunkerVersion: CHUNKER_VERSION,
    unitLen,
    chunks,
    sentenceAnchors: plan.sentences,
  });
  return plan;
}

export function loadChunks(docHash: string, text: string, unitLen: number): Chunk[] {
  return loadNarrationPlan(docHash, text, unitLen).chunks;
}
