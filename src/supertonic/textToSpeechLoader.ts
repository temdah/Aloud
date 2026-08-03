import { InferenceSession } from 'onnxruntime-react-native';
import { CONFIG_FILE, INDEXER_FILE, ONNX_MODEL_FILES, voiceFileName } from './models/modelCatalog';
import { modelFile, ortModelPath } from './models/modelStorage';
import { TextToSpeech } from './synthesis/textToSpeech';
import type { SupertonicConfig, VoiceStyleData } from './synthesis/synthesisTypes';
import { buildVoiceStyle, VoiceStyle } from './synthesis/voiceStyle';
import { UnicodeTextProcessor } from './text/unicodeTextProcessor';
import { traceOpen, traceSpan } from '../utils';

// Loads a model build's config + tokenizer + four ONNX sessions into a TextToSpeech.

// XNNPACK accelerates the vector estimator's float32 conv/matmul 1.5–3× on ARM;
// ORT falls unsupported ops back to CPU, worst case a create throw (caught per file).
const FAST_OPTIONS: InferenceSession.SessionOptions = {
  graphOptimizationLevel: 'all',
  executionProviders: ['xnnpack'],
  intraOpNumThreads: 4, // big-core count; the total drags in the slow little cores
};
const SAFE_OPTIONS: InferenceSession.SessionOptions = { graphOptimizationLevel: 'all' };

// Thrown when sessions fail to construct (usually a corrupt model that passed the
// download checks); the reader catches it to offer a re-download.
export class ModelLoadError extends Error {
  constructor(
    readonly modelId: string,
    readonly cause: unknown,
  ) {
    super(`Failed to load model "${modelId}": ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = 'ModelLoadError';
  }
}

async function createSession(path: string): Promise<InferenceSession> {
  try {
    return await InferenceSession.create(path, FAST_OPTIONS);
  } catch (e) {
    console.warn('[tts] xnnpack unavailable, falling back to CPU EP:', e);
    return InferenceSession.create(path, SAFE_OPTIONS);
  }
}

export async function loadTextToSpeech(modelId: string): Promise<TextToSpeech> {
  const config = (await modelFile(modelId, CONFIG_FILE).json()) as SupertonicConfig;
  const indexer = (await modelFile(modelId, INDEXER_FILE).json()) as number[];
  const textProcessor = new UnicodeTextProcessor(indexer);

  const create = (name: string, label: string) =>
    traceSpan(`load·${label}`, () => createSession(ortModelPath(modelId, name)));
  const endLoad = traceOpen('engine-load');
  try {
    const [durationPredictor, textEncoder, vectorEstimator, vocoder] = await Promise.all([
      create(ONNX_MODEL_FILES.durationPredictor, 'durationPredictor'),
      create(ONNX_MODEL_FILES.textEncoder, 'textEncoder'),
      create(ONNX_MODEL_FILES.vectorEstimator, 'vectorEstimator'),
      create(ONNX_MODEL_FILES.vocoder, 'vocoder'),
    ]);
    return new TextToSpeech(config, textProcessor, { durationPredictor, textEncoder, vectorEstimator, vocoder });
  } catch (e) {
    throw new ModelLoadError(modelId, e);
  } finally {
    endLoad();
  }
}

export async function loadVoiceStyle(modelId: string, voice: string): Promise<VoiceStyle> {
  const data = (await modelFile(modelId, voiceFileName(voice)).json()) as VoiceStyleData;
  return buildVoiceStyle(data);
}
