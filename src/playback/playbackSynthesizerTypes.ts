import type { InferencePriority, NarrationMetricsReporter, NarrationSettings } from '../supertonic';

export type PlaybackSynthesizerOptions = {
  docHash: string;
  documentText: string;
  settings: NarrationSettings;
};

export type PlaybackSynthesisRequest = {
  priority?: InferencePriority;
  onMetrics?: NarrationMetricsReporter;
  shouldContinue?: () => boolean;
};

export type PlaybackSynthesizerDependencies = {
  getVoice: typeof import('../supertonic').getVoice;
  withEngine: typeof import('../supertonic').withEngine;
  ensureChunkAudio: typeof import('../supertonic').ensureChunkAudio;
  ensureLeadAudio: typeof import('../supertonic').ensureLeadAudio;
  ensureSentenceAudio: typeof import('../supertonic').ensureSentenceAudio;
};
