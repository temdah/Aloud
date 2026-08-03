import type { NarrationSynthesisMetrics } from '../supertonic';
import type { PlaybackCacheDecision } from './playbackMetricsTypes';
import type { PlaybackSynthesizer } from './playbackSynthesizer';

export type PlaybackPreparationRequest = {
  shouldContinue: () => boolean;
  onDecision: (decision: PlaybackCacheDecision, cached: boolean) => void;
};

export type PreparedPlaybackClip = {
  uri: string;
  preparationStartedAt: number;
  metrics: NarrationSynthesisMetrics | null;
};

export type PlaybackPreparationOptions = {
  docHash: string;
  settings: import('../supertonic').NarrationSettings;
  synthesizer: Pick<PlaybackSynthesizer, 'prepareChunk' | 'prepareSentence'>;
};

export type PlaybackPreparationDependencies = {
  isChunkCached: typeof import('../supertonic').isChunkCached;
  isLeadCached: typeof import('../supertonic').isLeadCached;
  isSentenceCached: typeof import('../supertonic').isSentenceCached;
  chunkAudioUri: typeof import('../supertonic').chunkAudioUri;
  leadAudioFile: typeof import('../supertonic').leadAudioFile;
  sentenceAudioUri: typeof import('../supertonic').sentenceAudioUri;
};
