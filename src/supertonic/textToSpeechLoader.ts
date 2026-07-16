import { InferenceSession } from 'onnxruntime-react-native';
import { CONFIG_FILE, INDEXER_FILE, ONNX_MODEL_FILES, voiceFileName } from './models/modelCatalog';
import { modelFile, ortModelPath } from './models/modelStorage';
import { TextToSpeech } from './synthesis/textToSpeech';
import type { SupertonicConfig, VoiceStyleData } from './synthesis/synthesisTypes';
import { buildVoiceStyle, VoiceStyle } from './synthesis/voiceStyle';
import { UnicodeTextProcessor } from './text/unicodeTextProcessor';

// Prefer the XNNPACK execution provider — it accelerates the conv/matmul float32
// work of the vector estimator (run `steps` times per chunk) 1.5–3× on ARM. ORT
// partitions any unsupported op back to the CPU EP within the same session, so
// the worst case is a create-time throw, which we catch per file.
const FAST_OPTIONS: InferenceSession.SessionOptions = {
  graphOptimizationLevel: 'all',
  executionProviders: ['xnnpack'],
  // 4 ≈ big-core count on typical mid/upper Android SoCs; using total core count
  // pulls in the little cores and slows the pool.
  intraOpNumThreads: 4,
};
const SAFE_OPTIONS: InferenceSession.SessionOptions = { graphOptimizationLevel: 'all' };

// Thrown when the ONNX sessions fail to construct — typically a corrupt/truncated
// model file that passed the download checks. Screens catch this to offer a
// re-download instead of failing silently.
export class ModelLoadError extends Error {
  constructor(
    readonly modelId: string,
    readonly cause: unknown,
  ) {
    super(`Failed to load model "${modelId}": ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'ModelLoadError';
  }
}

// Per-file so one net can use XNNPACK even if another must fall back to CPU.
async function createSession(path: string): Promise<InferenceSession> {
  try {
    return await InferenceSession.create(path, FAST_OPTIONS);
  } catch (e) {
    console.warn('[tts] xnnpack unavailable, falling back to CPU EP:', e);
    return InferenceSession.create(path, SAFE_OPTIONS);
  }
}

// Loads the config, tokenizer, and four ONNX sessions for a model build from
// local storage and assembles a ready-to-use TextToSpeech instance. Assumes the
// build's files are downloaded.
export async function loadTextToSpeech(modelId: string): Promise<TextToSpeech> {
  const config = (await modelFile(modelId, CONFIG_FILE).json()) as SupertonicConfig;
  const indexer = (await modelFile(modelId, INDEXER_FILE).json()) as number[];
  const textProcessor = new UnicodeTextProcessor(indexer);

  const create = (name: string) => createSession(ortModelPath(modelId, name));
  try {
    const [durationPredictor, textEncoder, vectorEstimator, vocoder] = await Promise.all([
      create(ONNX_MODEL_FILES.durationPredictor),
      create(ONNX_MODEL_FILES.textEncoder),
      create(ONNX_MODEL_FILES.vectorEstimator),
      create(ONNX_MODEL_FILES.vocoder),
    ]);
    return new TextToSpeech(config, textProcessor, { durationPredictor, textEncoder, vectorEstimator, vocoder });
  } catch (e) {
    throw new ModelLoadError(modelId, e);
  }
}

export async function loadVoiceStyle(modelId: string, voice: string): Promise<VoiceStyle> {
  const data = (await modelFile(modelId, voiceFileName(voice)).json()) as VoiceStyleData;
  return buildVoiceStyle(data);
}
