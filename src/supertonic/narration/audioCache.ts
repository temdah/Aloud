import { Directory, File, Paths } from 'expo-file-system';
import { stableHash } from '../../utils';
import type { NarrationSettings } from './narrationTypes';

// Per-document TTS cache (documentDirectory/tts/<docHash>/). Files are keyed on
// (charStart, settingsHash), NOT array index, so re-chunking doesn't invalidate
// them. speed is deliberately excluded from the key (applied live at playback).

const ROOT = 'tts';
export const MIN_CACHED_BYTES = 256; // smaller than this = a failed/empty write

// settingsHash is one-way, so this registry maps it back to a readable profile
// for the "manage cached audio" UI.
const PROFILES_FILE = 'profiles.json';

// Bump when synthesis changes the audio for the same settings. v3: speed no
// longer baked in (applied live). v4: AAC (.m4a) instead of WAV (~10× smaller).
const SYNTH_VERSION = 4;

export function settingsHash(s: NarrationSettings): string {
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

export function chunkAudioFile(docHash: string, charStart: number, s: NarrationSettings): File {
  return new File(documentCacheDir(docHash), `${baseName(charStart, s)}.m4a`);
}

export function chunkTimingFile(docHash: string, charStart: number, s: NarrationSettings): File {
  return new File(documentCacheDir(docHash), `${baseName(charStart, s)}.timing.json`);
}

// Neutral-rate clip length (s), written alongside each cached chunk at synth time.
// Lets the document timeline rebuild from cached audio with no engine pass.
type ChunkTiming = { seconds: number };

export function readChunkTiming(docHash: string, charStart: number, s: NarrationSettings): number | null {
  const file = chunkTimingFile(docHash, charStart, s);
  if (!file.exists) return null;
  try {
    const parsed = JSON.parse(file.textSync()) as ChunkTiming;
    return typeof parsed.seconds === 'number' && parsed.seconds >= 0 ? parsed.seconds : null;
  } catch {
    return null;
  }
}

export function writeChunkTiming(docHash: string, charStart: number, s: NarrationSettings, seconds: number): void {
  const file = chunkTimingFile(docHash, charStart, s);
  try {
    if (file.exists) file.delete();
    file.create();
    file.write(JSON.stringify({ seconds } satisfies ChunkTiming));
  } catch {
    // Non-fatal: the timeline just falls back to the duration predictor.
  }
}

export function isChunkCached(docHash: string, charStart: number, s: NarrationSettings): boolean {
  const file = chunkAudioFile(docHash, charStart, s);
  return file.exists && file.size > MIN_CACHED_BYTES;
}

export function chunkAudioUri(docHash: string, charStart: number, s: NarrationSettings): string {
  return chunkAudioFile(docHash, charStart, s).uri;
}

// A fully-rendered book is stitched into one `book-<hash>.m4a`. `book-` can't
// collide with a chunk name (chunks start with a numeric charStart), and
// hashFromFileName still recovers the profile, so manage-cache groups it normally.
export function audiobookFile(docHash: string, s: NarrationSettings): File {
  return new File(documentCacheDir(docHash), `book-${settingsHash(s)}.m4a`);
}

export function isAudiobookCached(docHash: string, s: NarrationSettings): boolean {
  const file = audiobookFile(docHash, s);
  return file.exists && file.size > MIN_CACHED_BYTES;
}

export function audiobookAudioUri(docHash: string, s: NarrationSettings): string {
  return audiobookFile(docHash, s).uri;
}

// Real per-chunk start offsets in the stitched file (the muxer's clock, which
// drifts from predicted durations). `.index.json` name groups it with its profile.
const AUDIOBOOK_INDEX_VERSION = 1;
type AudiobookIndex = { version: number; startsSec: number[] };

export function audiobookIndexFile(docHash: string, s: NarrationSettings): File {
  return new File(documentCacheDir(docHash), `book-${settingsHash(s)}.index.json`);
}

export function readAudiobookIndex(docHash: string, s: NarrationSettings): number[] | null {
  const file = audiobookIndexFile(docHash, s);
  if (!file.exists) return null;
  try {
    const parsed = JSON.parse(file.textSync()) as AudiobookIndex;
    if (parsed.version !== AUDIOBOOK_INDEX_VERSION || !Array.isArray(parsed.startsSec)) return null;
    return parsed.startsSec;
  } catch {
    return null;
  }
}

export function writeAudiobookIndex(docHash: string, s: NarrationSettings, startsSec: number[]): void {
  const file = audiobookIndexFile(docHash, s);
  try {
    if (file.exists) file.delete();
    file.create();
    file.write(JSON.stringify({ version: AUDIOBOOK_INDEX_VERSION, startsSec } satisfies AudiobookIndex));
  } catch {
    // Non-fatal: playback falls back to predicted starts.
  }
}

// Fast-lead clips live in the OS cache dir (not the tts cache): a boundary lead
// shares a chunk's charStart, so caching it under the normal key would corrupt
// that chunk's clip. Keyed by length too, and disposable (OS may evict).
const LEAD_ROOT = 'tts-lead';

function leadCacheDir(): Directory {
  const dir = new Directory(Paths.cache, LEAD_ROOT);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

export function leadAudioFile(docHash: string, charStart: number, len: number, s: NarrationSettings): File {
  return new File(leadCacheDir(), `${docHash}-${charStart}-${len}-${settingsHash(s)}.m4a`);
}

export function isLeadCached(docHash: string, charStart: number, len: number, s: NarrationSettings): boolean {
  const file = leadAudioFile(docHash, charStart, len, s);
  return file.exists && file.size > MIN_CACHED_BYTES;
}

export function clearDocumentCache(docHash: string): void {
  const dir = new Directory(Paths.document, ROOT, docHash);
  if (dir.exists) dir.delete();
}

// meta is null when the profile predates the registry (couldn't be labelled).
export type ProfileMeta = { modelId: string; voiceId: string; steps: number; lang: string };
export type CachedProfile = { hash: string; meta: ProfileMeta | null; count: number; bytes: number };

function profilesRegistryFile(docHash: string): File {
  return new File(documentCacheDir(docHash), PROFILES_FILE);
}

function readProfilesRegistry(docHash: string): Record<string, ProfileMeta> {
  const file = new File(new Directory(Paths.document, ROOT, docHash), PROFILES_FILE);
  if (!file.exists) return {};
  try {
    return JSON.parse(file.textSync()) as Record<string, ProfileMeta>;
  } catch {
    return {};
  }
}

function writeProfilesRegistry(docHash: string, reg: Record<string, ProfileMeta>): void {
  const file = profilesRegistryFile(docHash);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(reg));
}

export function recordCachedProfile(docHash: string, s: NarrationSettings): void {
  const hash = settingsHash(s);
  const reg = readProfilesRegistry(docHash);
  if (reg[hash]) return;
  reg[hash] = { modelId: s.modelId, voiceId: s.voiceId, steps: s.steps, lang: s.lang };
  writeProfilesRegistry(docHash, reg);
}

// charStart is a non-negative int and settingsHash is base36 (no dashes), so the
// first dash separates them.
function hashFromFileName(name: string): string | null {
  const stem = name
    .replace(/\.timing\.json$/, '')
    .replace(/\.index\.json$/, '')
    .replace(/\.m4a$/, '');
  const dash = stem.indexOf('-');
  return dash < 0 ? null : stem.slice(dash + 1);
}

function fileName(uri: string): string {
  return uri.split('/').pop() ?? '';
}

export function listCachedProfiles(docHash: string): CachedProfile[] {
  const dir = new Directory(Paths.document, ROOT, docHash);
  if (!dir.exists) return [];
  const reg = readProfilesRegistry(docHash);
  const groups = new Map<string, { count: number; bytes: number }>();
  for (const entry of dir.list()) {
    if (!(entry instanceof File) || !entry.uri.endsWith('.m4a')) continue;
    const hash = hashFromFileName(fileName(entry.uri));
    if (!hash) continue;
    const g = groups.get(hash) ?? { count: 0, bytes: 0 };
    g.count += 1;
    g.bytes += entry.size ?? 0;
    groups.set(hash, g);
  }
  return [...groups.entries()]
    .map(([hash, g]) => ({ hash, meta: reg[hash] ?? null, count: g.count, bytes: g.bytes }))
    .sort((a, b) => b.bytes - a.bytes);
}

export function clearProfileCache(docHash: string, hash: string): void {
  const dir = new Directory(Paths.document, ROOT, docHash);
  if (!dir.exists) return;
  for (const entry of dir.list()) {
    if (!(entry instanceof File)) continue;
    if (hashFromFileName(fileName(entry.uri)) === hash) {
      try {
        entry.delete();
      } catch {}
    }
  }
  const reg = readProfilesRegistry(docHash);
  if (reg[hash]) {
    delete reg[hash];
    writeProfilesRegistry(docHash, reg);
  }
}

export function documentCacheStats(docHash: string): { count: number; bytes: number } {
  const dir = new Directory(Paths.document, ROOT, docHash);
  if (!dir.exists) return { count: 0, bytes: 0 };
  let count = 0;
  let bytes = 0;
  for (const entry of dir.list()) {
    if (entry instanceof File && entry.uri.endsWith('.m4a')) {
      count += 1;
      bytes += entry.size ?? 0;
    }
  }
  return { count, bytes };
}
