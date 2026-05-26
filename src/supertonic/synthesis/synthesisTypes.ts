// Types for the synthesis pipeline (inference, voice, audio output).

import type { InferenceSession } from 'onnxruntime-react-native';

/** The four ONNX sessions that make up the Supertonic pipeline. */
export type SupertonicSessions = {
  durationPredictor: InferenceSession;
  textEncoder: InferenceSession;
  vectorEstimator: InferenceSession;
  vocoder: InferenceSession;
};

/** Subset of the model's tts.json config that the pipeline consumes. */
export type SupertonicConfig = {
  ae: { sample_rate: number; base_chunk_size: number };
  ttl: { latent_dim: number; chunk_compress_factor: number };
};

/** Raw voice-embedding JSON, one file per voice (e.g. M1.json). */
export type VoiceStyleData = {
  style_ttl: { data: unknown; dims: number[] };
  style_dp: { data: unknown; dims: number[] };
};

/** Result of synthesizing a single utterance. */
export type SynthesisResult = {
  /** Mono waveform in the [-1, 1] float range. */
  waveform: Float32Array;
  /** Per-utterance predicted durations in seconds. */
  durationsSec: number[];
};

/** Reports denoising-loop progress (current step, total steps). */
export type SynthesisProgress = (currentStep: number, totalSteps: number) => void;
