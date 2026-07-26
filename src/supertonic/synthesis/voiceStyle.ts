import { Tensor } from 'onnxruntime-react-native';
import type { VoiceStyleData } from './synthesisTypes';

// Two precomputed speaker-embedding tensors per voice: `ttl` feeds the text
// encoder + vector estimator, `dp` feeds the duration predictor.
export class VoiceStyle {
  constructor(
    readonly ttl: Tensor,
    readonly dp: Tensor,
  ) {}
}

function flattenNumbers(value: unknown): number[] {
  return Array.isArray(value) ? (value as unknown[]).flatMap(flattenNumbers) : [value as number];
}

export function buildVoiceStyle(data: VoiceStyleData): VoiceStyle {
  const ttl = new Tensor('float32', Float32Array.from(flattenNumbers(data.style_ttl.data)), data.style_ttl.dims);
  const dp = new Tensor('float32', Float32Array.from(flattenNumbers(data.style_dp.data)), data.style_dp.dims);
  return new VoiceStyle(ttl, dp);
}
