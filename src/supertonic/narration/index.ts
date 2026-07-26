export { chunkText, buildChunks } from './textChunker';
export type { RawChunk } from './textChunker';
export { ensureChunkAudio, ensureLeadAudio } from './narrator';
export { prerenderDocument } from './prerender';
export type { PrerenderOptions, PrerenderProgress, PrerenderResult } from './prerender';
export {
  chunkAudioFile,
  chunkTimingFile,
  isChunkCached,
  isLeadCached,
  leadAudioFile,
  chunkAudioUri,
  isAudiobookCached,
  audiobookAudioUri,
  readAudiobookIndex,
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
export {
  ensureDurationTable,
  loadDurationTable,
  loadDurationTableFromCache,
  cumulativeOffsetsSec,
  totalDurationSec,
  locateTime,
} from './durationTable';
export type { DurationTable, TimeLocation, BuildDurationTableOptions } from './durationTable';
export type { NarrationSettings } from './narrationTypes';
