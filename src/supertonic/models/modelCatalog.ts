import type { ModelAsset } from './modelTypes';

// Conservative minimum byte sizes per file, used to detect truncated downloads.
// They differ per build (v3's nets are larger), so they live on each ModelInfo.
type FileMinBytes = {
  durationPredictor: number;
  textEncoder: number;
  vectorEstimator: number;
  vocoder: number;
  config: number;
  indexer: number;
  voice: number;
};

// A selectable Supertonic build. Both builds share the 4-stage pipeline and the
// same Hugging Face file layout (onnx/ + voice_styles/, F1–F5/M1–M5 voices);
// they differ in size, speed, language coverage, and quality.
export type ModelInfo = {
  id: string;
  label: string;
  repo: string;
  approxMb: number;
  tagline: string;
  overview: string;
  languages: string;
  minBytes: FileMinBytes;
};

export const MODELS: ModelInfo[] = [
  {
    id: 'supertonic-2',
    label: 'Supertonic 2',
    repo: 'Supertone/supertonic-2',
    approxMb: 263,
    tagline: 'Lighter & faster',
    overview: 'Smaller download and quicker to synthesize — the snappiest option. Best if you want fast setup and minimal waiting.',
    languages: 'English, Korean, Spanish, Portuguese, French',
    minBytes: {
      durationPredictor: 1_400_000,
      textEncoder: 26_000_000,
      vectorEstimator: 130_000_000,
      vocoder: 99_000_000,
      config: 1_000,
      indexer: 200_000,
      voice: 100_000,
    },
  },
  {
    id: 'supertonic-3',
    label: 'Supertonic 3',
    repo: 'Supertone/supertonic-3',
    approxMb: 398,
    tagline: 'Highest quality · 31 languages',
    overview: 'The most natural voice and the widest language coverage. Larger download and a bit slower to synthesize (heavier model).',
    languages: '31 languages',
    minBytes: {
      durationPredictor: 3_000_000,
      textEncoder: 30_000_000,
      vectorEstimator: 240_000_000,
      vocoder: 95_000_000,
      config: 2_000,
      indexer: 200_000,
      voice: 150_000,
    },
  },
];

// The model's real voice styles (one embedding JSON each on Hugging Face),
// shared across builds.
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

export function findModel(modelId: string | null | undefined): ModelInfo | undefined {
  return modelId ? MODELS.find((m) => m.id === modelId) : undefined;
}

export function getModel(modelId: string): ModelInfo {
  const model = findModel(modelId);
  if (!model) throw new Error(`Unknown model: ${modelId}`);
  return model;
}

// The full set of files to download for a given model + voice.
export function buildAssetList(modelId: string, voice: string): ModelAsset[] {
  const m = getModel(modelId);
  const base = `https://huggingface.co/${m.repo}/resolve/main`;
  return [
    { name: ONNX_MODEL_FILES.durationPredictor, url: `${base}/onnx/duration_predictor.onnx`, minBytes: m.minBytes.durationPredictor },
    { name: ONNX_MODEL_FILES.textEncoder, url: `${base}/onnx/text_encoder.onnx`, minBytes: m.minBytes.textEncoder },
    { name: ONNX_MODEL_FILES.vectorEstimator, url: `${base}/onnx/vector_estimator.onnx`, minBytes: m.minBytes.vectorEstimator },
    { name: ONNX_MODEL_FILES.vocoder, url: `${base}/onnx/vocoder.onnx`, minBytes: m.minBytes.vocoder },
    { name: CONFIG_FILE, url: `${base}/onnx/tts.json`, minBytes: m.minBytes.config },
    { name: INDEXER_FILE, url: `${base}/onnx/unicode_indexer.json`, minBytes: m.minBytes.indexer },
    { name: voiceFileName(voice), url: `${base}/voice_styles/${voice}.json`, minBytes: m.minBytes.voice },
  ];
}
