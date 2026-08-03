import { Directory, File, Paths } from 'expo-file-system';
import type { SentenceAnchor } from '../../types';
import type { AudiobookIndex, CachedProfile, ChunkTiming, ProfileMeta } from './audioCacheTypes';
import { sentenceCacheBaseName, sentenceSettingsHash, settingsHash } from './cacheIdentity';
import type { NarrationSettings } from './narrationTypes';

export { settingsHash } from './cacheIdentity';

// Audio keys use canonical offsets and synthesis settings; playback speed is applied live.

const ROOT = 'tts';
export const MIN_CACHED_BYTES = 256; // smaller than this = a failed/empty write
const directoryCache = new Map<string, Directory>();
const profileRegistryCache = new Map<string, Record<string, ProfileMeta>>();

// The registry maps one-way cache hashes back to labels for cache management.
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

// Timing sidecars let the document timeline rebuild without loading the engine.
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

function deleteFile(file: File): void {
  try {
    if (file.exists) file.delete();
  } catch {
  }
}

export function deleteChunkCache(docHash: string, charStart: number, s: NarrationSettings): void {
  deleteFile(chunkAudioFile(docHash, charStart, s));
  deleteFile(chunkTimingFile(docHash, charStart, s));
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

export function deleteSentenceCache(docHash: string, anchor: SentenceAnchor, s: NarrationSettings): void {
  deleteFile(sentenceAudioFile(docHash, anchor, s));
  deleteFile(sentenceTimingFile(docHash, anchor, s));
}

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

export function deleteAudiobookCache(docHash: string, s: NarrationSettings): void {
  deleteFile(audiobookFile(docHash, s));
  deleteFile(audiobookIndexFile(docHash, s));
}

// Store muxer offsets because they can drift from predicted durations.
const AUDIOBOOK_INDEX_VERSION = 1;
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
  }
}

// Fast leads are length-keyed so repeated mid-chunk starts reuse the same clip.
export function leadAudioFile(docHash: string, charStart: number, len: number, s: NarrationSettings): File {
  return new File(documentCacheDir(docHash), `lead-${charStart}-${len}-${settingsHash(s)}.m4a`);
}

export function isLeadCached(docHash: string, charStart: number, len: number, s: NarrationSettings): boolean {
  const file = leadAudioFile(docHash, charStart, len, s);
  return file.exists && file.size > MIN_CACHED_BYTES;
}

export function deleteLeadCache(docHash: string, charStart: number, len: number, s: NarrationSettings): void {
  deleteFile(leadAudioFile(docHash, charStart, len, s));
}

export function clearDocumentCache(docHash: string): void {
  const dir = directoryCache.get(docHash) ?? new Directory(Paths.document, ROOT, docHash);
  if (dir.exists) dir.delete();
  directoryCache.delete(docHash);
  profileRegistryCache.delete(docHash);
}

// Preserve stable sentence audio and full audiobooks while removing fragmented caches.
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

function profilesRegistryFile(docHash: string): File {
  return new File(documentCacheDir(docHash), PROFILES_FILE);
}

function readProfilesRegistry(docHash: string): Record<string, ProfileMeta> {
  const cached = profileRegistryCache.get(docHash);
  if (cached) return cached;
  try {
    const file = new File(new Directory(Paths.document, ROOT, docHash), PROFILES_FILE);
    if (!file.exists) {
      const empty = {};
      profileRegistryCache.set(docHash, empty);
      return empty;
    }
    const registry = JSON.parse(file.textSync()) as Record<string, ProfileMeta>;
    profileRegistryCache.set(docHash, registry);
    return registry;
  } catch {
    return {};
  }
}

function writeProfilesRegistry(docHash: string, reg: Record<string, ProfileMeta>): void {
  try {
    const file = profilesRegistryFile(docHash);
    if (file.exists) file.delete();
    file.create();
    file.write(JSON.stringify(reg));
    profileRegistryCache.set(docHash, reg);
  } catch {
    profileRegistryCache.delete(docHash);
  }
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
  writeProfilesRegistry(docHash, {
    ...reg,
    [hash]: { modelId: s.modelId, voiceId: s.voiceId, steps: s.steps, lang: s.lang, tone: s.tone },
  });
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
    const next = { ...reg };
    delete next[hash];
    writeProfilesRegistry(docHash, next);
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
