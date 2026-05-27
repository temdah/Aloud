import type { ModelAsset } from './modelTypes';

// Supertonic v2 (fp32) on Hugging Face. ~263 MB of ONNX total — fine on the
// 12 GB target device. There is no public int8 build; see project notes.
const HUGGING_FACE_REPO = 'Supertone/supertonic-2';
const BASE_URL = `https://huggingface.co/${HUGGING_FACE_REPO}/resolve/main`;

// The model's real voice styles (one embedding JSON each on Hugging Face).
export const AVAILABLE_VOICES = ['F1', 'F2', 'F3', 'F4', 'F5', 'M1', 'M2', 'M3', 'M4', 'M5'] as const;

export const DEFAULT_VOICE = 'M1';

// File names (relative to the model directory) for config and tokenizer assets.
export const CONFIG_FILE = 'tts.json';
export const INDEXER_FILE = 'unicode_indexer.json';
export const voiceFileName = (voice: string) => `${voice}.json`;

export const ONNX_MODEL_FILES = {
  durationPredictor: 'duration_predictor.onnx',
  textEncoder: 'text_encoder.onnx',
  vectorEstimator: 'vector_estimator.onnx',
  vocoder: 'vocoder.onnx',
} as const;

// The full set of files to download for a given voice, with conservative
// minimum sizes used to detect incomplete downloads.
export function buildAssetList(voice: string): ModelAsset[] {
  return [
    { name: ONNX_MODEL_FILES.durationPredictor, url: `${BASE_URL}/onnx/duration_predictor.onnx`, minBytes: 1_400_000 },
    { name: ONNX_MODEL_FILES.textEncoder, url: `${BASE_URL}/onnx/text_encoder.onnx`, minBytes: 26_000_000 },
    { name: ONNX_MODEL_FILES.vectorEstimator, url: `${BASE_URL}/onnx/vector_estimator.onnx`, minBytes: 130_000_000 },
    { name: ONNX_MODEL_FILES.vocoder, url: `${BASE_URL}/onnx/vocoder.onnx`, minBytes: 99_000_000 },
    { name: CONFIG_FILE, url: `${BASE_URL}/onnx/tts.json`, minBytes: 1_000 },
    { name: INDEXER_FILE, url: `${BASE_URL}/onnx/unicode_indexer.json`, minBytes: 200_000 },
    { name: voiceFileName(voice), url: `${BASE_URL}/voice_styles/${voice}.json`, minBytes: 100_000 },
  ];
}
