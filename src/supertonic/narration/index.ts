export { chunkText, buildChunks } from './textChunker';
export type { RawChunk } from './textChunker';
export { findChunkIndexForOffset } from './chunkLookup';
export { createNarrationPlan, EMPTY_NARRATION_PLAN } from './narrationPlan';
export type { NarrationPlan } from './narrationPlanTypes';
export { buildSentenceAnchors, MAX_SENTENCE_ANCHOR_CHARS, sentenceAnchorId } from './sentenceAnchors';
export { sentenceCacheBaseName, sentenceSettingsHash } from './cacheIdentity';
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
  sentenceAudioFile,
  sentenceTimingFile,
  isSentenceCached,
  sentenceAudioUri,
  readSentenceTiming,
  writeSentenceTiming,
  isAudiobookCached,
  audiobookAudioUri,
  readAudiobookIndex,
  clearDocumentCache,
  documentCacheStats,
  documentCacheDir,
  clearFragmentedCache,
  settingsHash,
  recordCachedProfile,
  recordSentenceCachedProfile,
  listCachedProfiles,
  clearProfileCache,
} from './audioCache';
export type { CachedProfile, ProfileMeta } from './audioCache';
export { readManifest, writeManifest, loadChunks, loadNarrationPlan } from './manifest';
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
