// Types for the synthesis pipeline (inference, voice, audio output).

import type { InferenceSession } from 'onnxruntime-react-native';

export type SupertonicSessions = {
  durationPredictor: InferenceSession;
  textEncoder: InferenceSession;
  vectorEstimator: InferenceSession;
  vocoder: InferenceSession;
};

export type SupertonicConfig = {
  ae: { sample_rate: number; base_chunk_size: number };
  ttl: { latent_dim: number; chunk_compress_factor: number };
};

export type VoiceStyleData = {
  style_ttl: { data: unknown; dims: number[] };
  style_dp: { data: unknown; dims: number[] };
};

export type SynthesisResult = {
  waveform: Float32Array; // mono, [-1, 1]
  durationsSec: number[];
};

export type SynthesisProgress = (currentStep: number, totalSteps: number) => void;

export type SynthesisStage = 'tokenize' | 'duration' | 'textEncoder' | 'initLatent' | 'denoise' | 'vocoder';

export type SynthesisStageReporter = (stage: SynthesisStage) => void;
