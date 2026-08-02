import { Directory, File, Paths } from 'expo-file-system';
import type { SentenceAnchor } from '../../types';
import { sentenceCacheBaseName, sentenceSettingsHash, settingsHash } from './cacheIdentity';
import type { NarrationSettings } from './narrationTypes';

export { settingsHash } from './cacheIdentity';

// Per-document TTS cache (documentDirectory/tts/<docHash>/). Files are keyed on
// (charStart, settingsHash), NOT array index, so re-chunking doesn't invalidate
// them. speed is deliberately excluded from the key (applied live at playback).

const ROOT = 'tts';
export const MIN_CACHED_BYTES = 256; // smaller than this = a failed/empty write
const directoryCache = new Map<string, Directory>();
const profileRegistryCache = new Map<string, Record<string, ProfileMeta>>();

// Cache hashes are one-way, so this registry maps them back to readable profiles
// for the "manage cached audio" UI.
const PROFILES_FILE = 'profiles.json';

export function documentCacheDir(docHash: string): Directory {
  const cached = directoryCache.get(docHash);
  if (cached) return cached;
  const dir = new Directory(Paths.document, ROOT, docHash);
  if (!dir.exists) dir.create({ intermediates: true });
  directoryCache.set(docHash, dir);
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

function readTiming(file: File): number | null {
  if (!file.exists) return null;
  try {
    const parsed = JSON.parse(file.textSync()) as ChunkTiming;
    return parsed.seconds >= 0 ? parsed.seconds : null;
  } catch {
    return null;
  }
}

function writeTiming(file: File, seconds: number): void {
  try {
    if (file.exists) file.delete();
    file.create();
    file.write(JSON.stringify({ seconds } satisfies ChunkTiming));
  } catch {
    // Non-fatal: callers can fall back to the duration predictor.
  }
}

export function readChunkTiming(docHash: string, charStart: number, s: NarrationSettings): number | null {
  return readTiming(chunkTimingFile(docHash, charStart, s));
}

export function writeChunkTiming(docHash: string, charStart: number, s: NarrationSettings, seconds: number): void {
  writeTiming(chunkTimingFile(docHash, charStart, s), seconds);
}

export function isChunkCached(docHash: string, charStart: number, s: NarrationSettings): boolean {
  const file = chunkAudioFile(docHash, charStart, s);
  return file.exists && file.size > MIN_CACHED_BYTES;
}

export function chunkAudioUri(docHash: string, charStart: number, s: NarrationSettings): string {
  return chunkAudioFile(docHash, charStart, s).uri;
}

export function sentenceAudioFile(docHash: string, anchor: SentenceAnchor, s: NarrationSettings): File {
  return new File(documentCacheDir(docHash), `${sentenceCacheBaseName(anchor, s)}.m4a`);
}

export function sentenceTimingFile(docHash: string, anchor: SentenceAnchor, s: NarrationSettings): File {
  return new File(documentCacheDir(docHash), `${sentenceCacheBaseName(anchor, s)}.timing.json`);
}

export function isSentenceCached(docHash: string, anchor: SentenceAnchor, s: NarrationSettings): boolean {
  const file = sentenceAudioFile(docHash, anchor, s);
  return file.exists && file.size > MIN_CACHED_BYTES;
}

export function sentenceAudioUri(docHash: string, anchor: SentenceAnchor, s: NarrationSettings): string {
  return sentenceAudioFile(docHash, anchor, s).uri;
}

export function readSentenceTiming(docHash: string, anchor: SentenceAnchor, s: NarrationSettings): number | null {
  return readTiming(sentenceTimingFile(docHash, anchor, s));
}

export function writeSentenceTiming(
  docHash: string,
  anchor: SentenceAnchor,
  s: NarrationSettings,
  seconds: number,
): void {
  writeTiming(sentenceTimingFile(docHash, anchor, s), seconds);
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

// Fast-lead clips: a partial "start here" clip covering a chunk's first sentence.
// Durable (in the doc cache, `lead-` prefixed so it can't collide with a chunk's
// numeric name) and keyed by length, so re-tapping a section replays from cache
// instead of re-synthesizing.
export function leadAudioFile(docHash: string, charStart: number, len: number, s: NarrationSettings): File {
  return new File(documentCacheDir(docHash), `lead-${charStart}-${len}-${settingsHash(s)}.m4a`);
}

export function isLeadCached(docHash: string, charStart: number, len: number, s: NarrationSettings): boolean {
  const file = leadAudioFile(docHash, charStart, len, s);
  return file.exists && file.size > MIN_CACHED_BYTES;
}

export function clearDocumentCache(docHash: string): void {
  const dir = directoryCache.get(docHash) ?? new Directory(Paths.document, ROOT, docHash);
  if (dir.exists) dir.delete();
  directoryCache.delete(docHash);
  profileRegistryCache.delete(docHash);
}

// Clear chunk/lead clips, their timing sidecars, and the duration table. Stable
// sentence audio survives re-chunking, alongside full audiobooks and profiles.
export function clearFragmentedCache(docHash: string): void {
  const dir = new Directory(Paths.document, ROOT, docHash);
  if (!dir.exists) return;
  for (const entry of dir.list()) {
    if (!(entry instanceof File)) continue;
    const name = fileName(entry.uri);
    if (name.startsWith('book-') || name.startsWith('sentence-') || name === PROFILES_FILE) continue;
    try {
      entry.delete();
    } catch {}
  }
}

// meta is null when the profile predates the registry (couldn't be labelled).
export type ProfileMeta = { modelId: string; voiceId: string; steps: number; lang: string };
export type CachedProfile = { hash: string; meta: ProfileMeta | null; count: number; bytes: number };

function profilesRegistryFile(docHash: string): File {
  return new File(documentCacheDir(docHash), PROFILES_FILE);
}

function readProfilesRegistry(docHash: string): Record<string, ProfileMeta> {
  const cached = profileRegistryCache.get(docHash);
  if (cached) return cached;
  const file = new File(new Directory(Paths.document, ROOT, docHash), PROFILES_FILE);
  if (!file.exists) {
    const empty = {};
    profileRegistryCache.set(docHash, empty);
    return empty;
  }
  try {
    const registry = JSON.parse(file.textSync()) as Record<string, ProfileMeta>;
    profileRegistryCache.set(docHash, registry);
    return registry;
  } catch {
    const empty = {};
    profileRegistryCache.set(docHash, empty);
    return empty;
  }
}

function writeProfilesRegistry(docHash: string, reg: Record<string, ProfileMeta>): void {
  const file = profilesRegistryFile(docHash);
  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(reg));
  profileRegistryCache.set(docHash, reg);
}

export function recordCachedProfile(docHash: string, s: NarrationSettings): void {
  recordProfile(docHash, settingsHash(s), s);
}

export function recordSentenceCachedProfile(docHash: string, s: NarrationSettings): void {
  recordProfile(docHash, sentenceSettingsHash(s), s);
}

function recordProfile(docHash: string, hash: string, s: NarrationSettings): void {
  const reg = readProfilesRegistry(docHash);
  if (reg[hash]) return;
  reg[hash] = { modelId: s.modelId, voiceId: s.voiceId, steps: s.steps, lang: s.lang };
  writeProfilesRegistry(docHash, reg);
}

// settingsHash is base36 (no dashes) and always the final dash-segment, across
// every name shape: `<charStart>-<hash>`, `book-<hash>`, `lead-<start>-<len>-<hash>`.
function hashFromFileName(name: string): string | null {
  const stem = name
    .replace(/\.timing\.json$/, '')
    .replace(/\.index\.json$/, '')
    .replace(/\.m4a$/, '');
  const dash = stem.lastIndexOf('-');
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
