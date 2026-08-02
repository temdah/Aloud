export { chunkText, buildChunks } from './textChunker';
export type { RawChunk } from './textChunker';
export { findChunkIndexForOffset } from './chunkLookup';
export { ensureChunkAudio, ensureLeadAudio } from './narrator';
export { clearNarrationPerfCounters, getNarrationPerfCounters, getSynthRtf } from './perfStats';
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
  clearFragmentedCache,
  settingsHash,
  recordCachedProfile,
  listCachedProfiles,
  clearProfileCache,
} from './audioCache';
export type { CachedProfile, ProfileMeta } from './audioCache';
export { readManifest, writeManifest, loadChunks } from './manifest';
export {
  ensureDurationTable,
  buildTimeline,
  loadDurationTable,
  loadDurationTableFromCache,
  cumulativeOffsetsSec,
  totalDurationSec,
  locateTime,
} from './durationTable';
export type { DurationTable, TimeLocation, BuildDurationTableOptions } from './durationTable';
export type { NarrationMetricsReporter, NarrationSettings, NarrationSynthesisMetrics } from './narrationTypes';
