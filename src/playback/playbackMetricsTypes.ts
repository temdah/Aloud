export type PlaybackRequestKind = 'audiobook' | 'canonical' | 'sentence' | 'fast-lead' | 'resume';

export type PlaybackCacheDecision =
  | 'audiobook-cache'
  | 'loaded-player'
  | 'canonical-cache'
  | 'sentence-cache'
  | 'lead-cache'
  | 'canonical-synthesis'
  | 'sentence-synthesis'
  | 'lead-synthesis'
  | 'deduplicated-synthesis';

export type PlaybackSynthesisBreakdown = {
  synthMs: number;
  pcmMs: number;
  aacMs: number;
  totalMs: number;
};

export type PlaybackTrace = {
  id: number;
  kind: PlaybackRequestKind;
  chars: number;
  fastLeadChars: number | null;
  startedAtMs: number;
  cacheDecision: PlaybackCacheDecision | null;
  cacheDecisionMs: number | null;
  prepareMs: number | null;
  queueWaitMs: number | null;
  synthesis: PlaybackSynthesisBreakdown | null;
  playerRequestedMs: number | null;
  playerLoadedMs: number | null;
  playerPlayingMs: number | null;
  outcome: 'pending' | 'playing' | 'cancelled' | 'error';
};

export type BoundaryGap = {
  durationMs: number;
  nextWasCached: boolean;
};

export type PrefetchSample = {
  depth: number;
  synthThroughput: number | null;
};

export type PlaybackDiagnosticsSnapshot = {
  traces: PlaybackTrace[];
  boundaryGaps: BoundaryGap[];
  prefetch: PrefetchSample[];
};

export type MutablePlaybackTrace = PlaybackTrace & {
  cacheDecisionAtMs: number | null;
  playerRequestedAtMs: number | null;
};
