import type { Quality } from '../qualityProfileTypes';
import type { SynthesisDiagnostics } from '../synthesis/synthesisTypes';
import type { NarrationTone, ResolvedNarrationTone } from '../../types';
import type { ProsodyBoundary } from './prosodyTypes';

// Settings that determine how a chunk is synthesized and cached — changing any
// of these changes the cache key (a different file).
export type NarrationSettings = {
  modelId: string;
  voiceId: string;
  speed: number;
  steps: number;
  lang: string;
  quality: Quality;
  tone: NarrationTone;
};

// Reported only when a cache miss actually synthesizes a new clip. This keeps
// production behavior unchanged while the developer lab can inspect the real
// PCM -> AAC path without duplicating it.
export type NarrationSynthesisMetrics = SynthesisDiagnostics & {
  synthMs: number;
  pcmMs: number;
  aacMs: number;
  totalMs: number;
  outputBytes: number;
  requestedTone: NarrationTone;
  resolvedTone: ResolvedNarrationTone;
  synthesisSpeed: number;
  trailingPauseMs: number;
  prosodyBoundary: ProsodyBoundary;
};

export type NarrationMetricsReporter = (metrics: NarrationSynthesisMetrics) => void;
