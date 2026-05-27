// Settings that determine how a chunk is synthesized and how it is cached.
// Changing any of these produces a different cache key (different file).
export type NarrationSettings = {
  /** Voice id, e.g. 'M1' / 'F2'. */
  voiceId: string;
  /** Speech speed factor (~0.9–1.5). */
  speed: number;
  /** Denoising/inference steps (quality vs. latency). */
  steps: number;
  /** Language tag for the text, e.g. 'en'. */
  lang: string;
};
