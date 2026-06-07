import { Directory, File, Paths } from 'expo-file-system';
import { stableHash } from '../../utils';
import type { NarrationSettings } from './narrationTypes';

// Per-document TTS cache: documentDirectory/tts/<docHash>/.
// Files are keyed on (charStart, settingsHash) — NOT array index — so the cache
// stays valid even if a future version re-chunks differently (§7.3/§7.4).
// Changing voice/speed/steps flips settingsHash → clean miss, old audio kept.

const ROOT = 'tts';
const WAV_HEADER_BYTES = 44;
// Registry mapping each settingsHash present in a doc's cache → the human-
// readable profile it was rendered with. settingsHash is one-way, so without
// this we couldn't label cached voices in the "manage cached audio" UI.
const PROFILES_FILE = 'profiles.json';

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

/** The settings a cached profile was rendered with (speed is excluded — it's
 *  applied live, not baked into the audio). `null` when the profile predates the
 *  registry (e.g. cached before this feature) and couldn't be labelled. */
export type ProfileMeta = { modelId: string; voiceId: string; steps: number; lang: string };

/** One voice/profile's footprint within a document's cache. */
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

// Records that a profile (settingsHash) now has cache for this document, so the
// management UI can label it. Cheap + idempotent: only writes when the hash is
// new. Called from ensureChunkAudio so every synthesized profile is registered.
export function recordCachedProfile(docHash: string, s: NarrationSettings): void {
  const hash = settingsHash(s);
  const reg = readProfilesRegistry(docHash);
  if (reg[hash]) return;
  reg[hash] = { modelId: s.modelId, voiceId: s.voiceId, steps: s.steps, lang: s.lang };
  writeProfilesRegistry(docHash, reg);
}

// Extract the settingsHash from a cache filename `${charStart}-${hash}.wav`
// (and `.timing.json`). charStart is a non-negative int and settingsHash is
// base36 (no dashes), so the FIRST dash always separates the two.
function hashFromFileName(name: string): string | null {
  const stem = name.replace(/\.timing\.json$/, '').replace(/\.wav$/, '');
  const dash = stem.indexOf('-');
  return dash < 0 ? null : stem.slice(dash + 1);
}

function fileName(uri: string): string {
  return uri.split('/').pop() ?? '';
}

/** Group a document's cached audio by profile (voice), with size + clip count,
 *  for the per-voice "manage cached audio" UI. */
export function listCachedProfiles(docHash: string): CachedProfile[] {
  const dir = new Directory(Paths.document, ROOT, docHash);
  if (!dir.exists) return [];
  const reg = readProfilesRegistry(docHash);
  const groups = new Map<string, { count: number; bytes: number }>();
  for (const entry of dir.list()) {
    if (!(entry instanceof File) || !entry.uri.endsWith('.wav')) continue;
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

/** Remove every cached file (audio + timing) for one profile, leaving other
 *  voices' caches intact, and drop it from the registry. */
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
