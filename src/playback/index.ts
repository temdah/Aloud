export { PlaybackProvider, usePlaybackContext } from './PlaybackContext';
export type { ActiveDoc, PlaybackContextValue } from './playbackContextTypes';
export { buildFastStart, buildLead, prefetchDepth } from './playbackPlanning';
export type { FastStart, Lead } from './playbackPlanningTypes';
export type { Playback, UsePlaybackOptions } from './playbackTypes';
export { buildNeutralStarts, neutralTimeForOffset } from './playbackTimeline';
export { findSentenceIndexForOffset, sentenceTargetAtIndex, sentenceTargetForStart } from './sentencePlayback';
export type { SentencePlaybackTarget } from './sentencePlaybackTypes';
export { PlaybackRequestGate } from './playbackRequestGate';
export type { PlaybackRequestId } from './playbackRequestGate';
export { PlaybackRecoveryGate } from './playbackRecoveryGate';
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
} from './playbackMetricsTypes';
