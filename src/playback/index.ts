export { PlaybackProvider, usePlaybackContext } from './PlaybackContext';
export type { ActiveDoc, PlaybackContextValue } from './PlaybackContext';
export { buildFastStart, buildLead, prefetchDepth } from './playbackPlanning';
export type { FastStart, Lead } from './playbackPlanning';
export {
  cancelPlaybackTrace,
  clearPlaybackDiagnostics,
  failPlaybackTrace,
  finishPlaybackTrace,
  getPlaybackDiagnostics,
  markPlaybackCacheDecision,
  markPlaybackPlayerLoaded,
  markPlaybackPlayerRequested,
  markPlaybackPrepared,
  recordBoundaryGap,
  recordPrefetchDepth,
  startPlaybackTrace,
} from './playbackMetrics';
export type {
  BoundaryGap,
  PlaybackCacheDecision,
  PlaybackDiagnosticsSnapshot,
  PlaybackRequestKind,
  PlaybackSynthesisBreakdown,
  PlaybackTrace,
  PrefetchSample,
} from './playbackMetrics';
