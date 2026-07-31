import type { Quality } from '../qualityProfile';

// Settings that determine how a chunk is synthesized and cached — changing any
// of these changes the cache key (a different file).
export type NarrationSettings = {
  modelId: string;
  voiceId: string;
  speed: number;
  steps: number;
  lang: string;
  quality: Quality;
};
