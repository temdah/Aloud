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
// v3: speed is no longer baked into the audio — clips are rendered at the engine's
// neutral rate and the desired speed is applied live via the player's playback
// rate, so changing speed never invalidates the cache (old speed-keyed clips from
// v2 simply orphan until the cache is cleared).
const SYNTH_VERSION = 3;

export function settingsHash(s: NarrationSettings): string {
  // NOTE: speed deliberately excluded — see SYNTH_VERSION note above.
  return stableHash(`v${SYNTH_VERSION}|${s.modelId}|${s.voiceId}|${s.steps}|${s.lang}`);
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

/** The file:// uri of a chunk's cached audio (caller must ensure it's cached). */
export function chunkAudioUri(docHash: string, charStart: number, s: NarrationSettings): string {
  return chunkWavFile(docHash, charStart, s).uri;
}

// Removes all cached audio/timing for a document (e.g. "clear cached audio").
export function clearDocumentCache(docHash: string): void {
  const dir = new Directory(Paths.document, ROOT, docHash);
  if (dir.exists) dir.delete();
}

/** Count + total bytes of a document's cached audio (for "manage recordings"). */
export function documentCacheStats(docHash: string): { count: number; bytes: number } {
  const dir = new Directory(Paths.document, ROOT, docHash);
  if (!dir.exists) return { count: 0, bytes: 0 };
  let count = 0;
  let bytes = 0;
  for (const entry of dir.list()) {
    if (entry instanceof File && entry.uri.endsWith('.wav')) {
      count += 1;
      bytes += entry.size ?? 0;
    }
  }
  return { count, bytes };
}
