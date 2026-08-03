export { buildFastStart, buildLead, classifyDevicePressure, prefetchDepth } from '../playbackPlanning';
export type { DevicePlaybackSnapshot, DevicePressure } from '../devicePlaybackPolicyTypes';
export type { FastStart, Lead } from '../playbackPlanningTypes';
export type { Playback, UsePlaybackOptions } from '../playbackTypes';
export { buildNeutralStarts, neutralTimeForOffset } from '../playbackTimeline';
export { calculateDocumentPosition, charOffsetForTime, findChunkIndexAtTime } from '../playbackPosition';
export type { DocumentPosition, DocumentPositionInput } from '../playbackPositionTypes';
export { findSentenceIndexForOffset, sentenceTargetAtIndex, sentenceTargetForStart } from '../sentencePlayback';
export type { SentencePlaybackTarget } from '../sentencePlaybackTypes';
export { PlaybackRequestGate } from '../playbackRequestGate';
export type { PlaybackRequestId } from '../playbackRequestGate';
export { PlaybackRecoveryGate } from '../playbackRecoveryGate';
export { PlaybackRecoveryController } from '../playbackRecovery';
export type {
  PlaybackRecoveryAction,
  PlaybackRecoveryContext,
  PlaybackRecoveryDependencies,
  RecoverableClip,
} from '../playbackRecoveryTypes';
export { PlaybackSynthesizer } from '../playbackSynthesizer';
export type {
  PlaybackSynthesisRequest,
  PlaybackSynthesizerDependencies,
  PlaybackSynthesizerOptions,
} from '../playbackSynthesizerTypes';
export { PlaybackPrefetcher } from '../playbackPrefetcher';
export type {
  CanonicalPrefetchRequest,
  PlaybackPrefetcherDependencies,
  PlaybackPrefetcherOptions,
  SentencePrefetchRequest,
} from '../playbackPrefetcherTypes';
export { PlaybackPlayerController } from '../playbackPlayerControl';
export type { PlaybackPlayerPort } from '../playbackPlayerControlTypes';
export { PlaybackPreparation } from '../playbackPreparation';
export type {
  PlaybackPreparationDependencies,
  PlaybackPreparationOptions,
  PlaybackPreparationRequest,
  PreparedPlaybackClip,
} from '../playbackPreparationTypes';
export { resolvePlaybackArtworkUrl } from '../playbackArtwork';
export {
  buildPlaybackLockMetadata,
  mirroredPlaybackRate,
  usePlaybackMediaSession,
} from '../playbackMediaSession';
export type {
  PlaybackLockMetadata,
  PlaybackMediaSession,
  PlaybackMediaSessionOptions,
} from '../playbackMediaSessionTypes';
export { resolveWarmEngineModel, shouldReleaseEngineOnBackground } from '../engineWarmPolicy';
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
} from '../playbackMetrics';
export type {
  BoundaryGap,
  PlaybackCacheDecision,
  PlaybackDiagnosticsSnapshot,
  PlaybackRequestKind,
  PlaybackSynthesisBreakdown,
  PlaybackTrace,
  PrefetchSample,
} from '../playbackMetricsTypes';
