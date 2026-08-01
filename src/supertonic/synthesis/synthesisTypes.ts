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
  diagnostics: SynthesisDiagnostics;
};

// Shape/size facts needed to compare synthesis runs fairly. Character count
// alone is misleading because the duration predictor controls latent/audio size.
export type SynthesisDiagnostics = {
  inputChars: number;
  tokenCount: number; // normalized text including the language wrapper
  predictedSec: number;
  audioSec: number;
  latentDim: number;
  latentLen: number;
  waveformSamples: number;
};

export type SynthesisProgress = (currentStep: number, totalSteps: number) => void;

export type SynthesisStage = 'tokenize' | 'duration' | 'textEncoder' | 'initLatent' | 'denoise' | 'vocoder';

export type SynthesisStageReporter = (stage: SynthesisStage) => void;
