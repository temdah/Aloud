import type { SynthesisDiagnostics } from '../supertonic';
import type { Span } from '../utils';

export type VoiceBenchmarkConfig = {
  modelId: string | null;
  voiceId: string;
  language: string;
  steps: number;
};

export type VoiceChunkBenchmark = {
  stages: Record<string, number>;
  stepStarts: number[];
  synthMs: number;
  encodeMs: number;
  writeMs: number;
  audioSec: number;
  predictedSec: number;
  diagnostics: SynthesisDiagnostics;
  uri: string;
};

export type VoicePlaybackBenchmark = {
  audioSessionMs: number;
  createMs: number;
  loadedMs: number | null;
  playingMs: number | null;
  timedOut: boolean;
};

export type ColdLoadBenchmark = { totalMs: number; spans: Span[] };
