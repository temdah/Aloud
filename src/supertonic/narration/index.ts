export { chunkText, buildChunks } from './textChunker';
export type { RawChunk } from './textChunker';
export { ensureChunkAudio } from './narrator';
export { prerenderDocument } from './prerender';
export type { PrerenderOptions, PrerenderProgress, PrerenderResult } from './prerender';
export {
  chunkWavFile,
  chunkTimingFile,
  isChunkCached,
  chunkAudioUri,
  clearDocumentCache,
  documentCacheStats,
  documentCacheDir,
  settingsHash,
  recordCachedProfile,
  listCachedProfiles,
  clearProfileCache,
} from './audioCache';
export type { CachedProfile, ProfileMeta } from './audioCache';
export { readManifest, writeManifest, loadChunks } from './manifest';
export type { NarrationSettings } from './narrationTypes';
