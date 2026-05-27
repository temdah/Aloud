import { Directory, File, Paths } from 'expo-file-system';
import { stableHash } from '../../utils';
import type { NarrationSettings } from './narrationTypes';

// Per-document TTS cache: documentDirectory/tts/<docHash>/.
// Files are keyed on (charStart, settingsHash) — NOT array index — so the cache
// stays valid even if a future version re-chunks differently (§7.3/§7.4).
// Changing voice/speed/steps flips settingsHash → clean miss, old audio kept.

const ROOT = 'tts';
const WAV_HEADER_BYTES = 44;

// Bump when text preprocessing / synthesis changes the produced audio for the
// same settings, so stale cached WAVs are regenerated instead of replayed.
const SYNTH_VERSION = 2;

export function settingsHash(s: NarrationSettings): string {
  return stableHash(`v${SYNTH_VERSION}|${s.modelId}|${s.voiceId}|${s.speed}|${s.steps}|${s.lang}`);
}

export function documentCacheDir(docHash: string): Directory {
  const dir = new Directory(Paths.document, ROOT, docHash);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

function baseName(charStart: number, s: NarrationSettings): string {
  return `${charStart}-${settingsHash(s)}`;
}

export function chunkWavFile(docHash: string, charStart: number, s: NarrationSettings): File {
  return new File(documentCacheDir(docHash), `${baseName(charStart, s)}.wav`);
}

/** Map B timing sidecar (time -> text) for this chunk; written when available. */
export function chunkTimingFile(docHash: string, charStart: number, s: NarrationSettings): File {
  return new File(documentCacheDir(docHash), `${baseName(charStart, s)}.timing.json`);
}

export function isChunkCached(docHash: string, charStart: number, s: NarrationSettings): boolean {
  const file = chunkWavFile(docHash, charStart, s);
  return file.exists && file.size > WAV_HEADER_BYTES;
}

// Removes all cached audio/timing for a document (e.g. "clear cached audio").
export function clearDocumentCache(docHash: string): void {
  const dir = new Directory(Paths.document, ROOT, docHash);
  if (dir.exists) dir.delete();
}
