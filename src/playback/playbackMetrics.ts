const MAX_TRACES = 40;
const MAX_GAPS = 100;
const MAX_PREFETCH_SAMPLES = 100;

export type PlaybackRequestKind = 'audiobook' | 'canonical' | 'fast-lead' | 'resume';

export type PlaybackCacheDecision =
  | 'audiobook-cache'
  | 'loaded-player'
  | 'canonical-cache'
  | 'lead-cache'
  | 'canonical-synthesis'
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

type MutableTrace = PlaybackTrace & {
  cacheDecisionAtMs: number | null;
  playerRequestedAtMs: number | null;
};

let nextTraceId = 1;
let traces: MutableTrace[] = [];
let boundaryGaps: BoundaryGap[] = [];
let prefetchSamples: PrefetchSample[] = [];

function findTrace(id: number): MutableTrace | undefined {
  return traces.find((trace) => trace.id === id);
}

function trim<T>(values: T[], limit: number): void {
  if (values.length > limit) values.splice(0, values.length - limit);
}

export function startPlaybackTrace(input: {
  kind: PlaybackRequestKind;
  chars?: number;
  fastLeadChars?: number | null;
}): number {
  const trace: MutableTrace = {
    id: nextTraceId++,
    kind: input.kind,
    chars: input.chars ?? 0,
    fastLeadChars: input.fastLeadChars ?? null,
    startedAtMs: Date.now(),
    cacheDecision: null,
    cacheDecisionMs: null,
    cacheDecisionAtMs: null,
    prepareMs: null,
    queueWaitMs: null,
    synthesis: null,
    playerRequestedMs: null,
    playerRequestedAtMs: null,
    playerLoadedMs: null,
    playerPlayingMs: null,
    outcome: 'pending',
  };
  traces.push(trace);
  trim(traces, MAX_TRACES);
  return trace.id;
}

export function markPlaybackCacheDecision(id: number, decision: PlaybackCacheDecision): void {
  const trace = findTrace(id);
  if (!trace || trace.outcome !== 'pending') return;
  const now = Date.now();
  trace.cacheDecision = decision;
  trace.cacheDecisionAtMs = now;
  trace.cacheDecisionMs = now - trace.startedAtMs;
}

export function markPlaybackPrepared(
  id: number,
  preparationStartedAtMs: number,
  synthesis?: PlaybackSynthesisBreakdown | null,
): void {
  const trace = findTrace(id);
  if (!trace || trace.outcome !== 'pending') return;
  const prepareMs = Math.max(0, Date.now() - preparationStartedAtMs);
  trace.prepareMs = prepareMs;
  trace.synthesis = synthesis ?? null;
  if (synthesis) {
    trace.queueWaitMs = Math.max(0, prepareMs - synthesis.totalMs);
  } else if (trace.cacheDecision?.endsWith('synthesis')) {
    trace.queueWaitMs = prepareMs;
    trace.cacheDecision = 'deduplicated-synthesis';
  } else {
    trace.queueWaitMs = null;
  }
}

export function markPlaybackPlayerRequested(id: number): void {
  const trace = findTrace(id);
  if (!trace || trace.outcome !== 'pending') return;
  const now = Date.now();
  trace.playerRequestedAtMs = now;
  trace.playerRequestedMs = now - trace.startedAtMs;
}

export function markPlaybackPlayerLoaded(id: number): void {
  const trace = findTrace(id);
  if (!trace || trace.outcome !== 'pending' || trace.playerRequestedAtMs == null || trace.playerLoadedMs != null) return;
  trace.playerLoadedMs = Date.now() - trace.startedAtMs;
}

export function finishPlaybackTrace(id: number): void {
  const trace = findTrace(id);
  if (!trace || trace.outcome !== 'pending' || trace.playerRequestedAtMs == null) return;
  const now = Date.now();
  if (trace.playerLoadedMs == null) trace.playerLoadedMs = now - trace.startedAtMs;
  trace.playerPlayingMs = now - trace.startedAtMs;
  trace.outcome = 'playing';
}

export function cancelPlaybackTrace(id: number): void {
  const trace = findTrace(id);
  if (trace?.outcome === 'pending') trace.outcome = 'cancelled';
}

export function failPlaybackTrace(id: number): void {
  const trace = findTrace(id);
  if (trace?.outcome === 'pending') trace.outcome = 'error';
}

export function recordBoundaryGap(durationMs: number, nextWasCached: boolean): void {
  if (!Number.isFinite(durationMs) || durationMs < 0) return;
  boundaryGaps.push({ durationMs, nextWasCached });
  trim(boundaryGaps, MAX_GAPS);
}

export function recordPrefetchDepth(depth: number, synthThroughput: number | null): void {
  prefetchSamples.push({ depth, synthThroughput });
  trim(prefetchSamples, MAX_PREFETCH_SAMPLES);
}

export function getPlaybackDiagnostics(): PlaybackDiagnosticsSnapshot {
  return {
    traces: traces.map(({ cacheDecisionAtMs: _cacheAt, playerRequestedAtMs: _playerAt, ...trace }) => ({ ...trace })),
    boundaryGaps: boundaryGaps.map((gap) => ({ ...gap })),
    prefetch: prefetchSamples.map((sample) => ({ ...sample })),
  };
}

export function clearPlaybackDiagnostics(): void {
  traces = [];
  boundaryGaps = [];
  prefetchSamples = [];
}
