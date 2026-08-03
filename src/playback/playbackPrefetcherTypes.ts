import type { NarrationPlan, NarrationSettings } from '../supertonic';
import type { Chunk } from '../types';
import type { PlaybackSynthesizer } from './playbackSynthesizer';

export type PlaybackPrefetcherOptions = {
  docHash: string;
  settings: NarrationSettings;
  synthesizer: Pick<PlaybackSynthesizer, 'prepareChunk' | 'prepareSentence'>;
};

export type CanonicalPrefetchRequest = {
  chunks: readonly Chunk[];
  startIndex: number;
  immediate?: Chunk | null;
  enclosing?: Chunk | null;
  shouldContinue: () => boolean;
};

export type SentencePrefetchRequest = {
  plan: NarrationPlan;
  startIndex: number;
  shouldContinue: () => boolean;
};

export type PlaybackPrefetcherDependencies = {
  getDevicePerformanceSnapshot: typeof import('../../modules/device-performance').getDevicePerformanceSnapshot;
  getSynthRtf: typeof import('../supertonic').getSynthRtf;
  isChunkCached: typeof import('../supertonic').isChunkCached;
  isSentenceCached: typeof import('../supertonic').isSentenceCached;
  classifyDevicePressure: typeof import('./playbackPlanning').classifyDevicePressure;
  prefetchDepth: typeof import('./playbackPlanning').prefetchDepth;
  recordPrefetchDepth: typeof import('./playbackMetrics').recordPrefetchDepth;
};
