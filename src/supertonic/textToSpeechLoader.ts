import { InferenceSession } from 'onnxruntime-react-native';
import { CONFIG_FILE, INDEXER_FILE, ONNX_MODEL_FILES, voiceFileName } from './models/modelCatalog';
import { modelFile, ortModelPath } from './models/modelStorage';
import { TextToSpeech } from './synthesis/textToSpeech';
import type { SupertonicConfig, VoiceStyleData } from './synthesis/synthesisTypes';
import { buildVoiceStyle, VoiceStyle } from './synthesis/voiceStyle';
import { UnicodeTextProcessor } from './text/unicodeTextProcessor';

const SESSION_OPTIONS: InferenceSession.SessionOptions = { graphOptimizationLevel: 'all' };

// Loads the config, tokenizer, and four ONNX sessions for a model build from
// local storage and assembles a ready-to-use TextToSpeech instance. Assumes the
// build's files are downloaded.
export async function loadTextToSpeech(modelId: string): Promise<TextToSpeech> {
  const config = (await modelFile(modelId, CONFIG_FILE).json()) as SupertonicConfig;
  const indexer = (await modelFile(modelId, INDEXER_FILE).json()) as number[];
  const textProcessor = new UnicodeTextProcessor(indexer);

  const create = (name: string) => InferenceSession.create(ortModelPath(modelId, name), SESSION_OPTIONS);
  const [durationPredictor, textEncoder, vectorEstimator, vocoder] = await Promise.all([
    create(ONNX_MODEL_FILES.durationPredictor),
    create(ONNX_MODEL_FILES.textEncoder),
    create(ONNX_MODEL_FILES.vectorEstimator),
    create(ONNX_MODEL_FILES.vocoder),
  ]);

  return new TextToSpeech(config, textProcessor, { durationPredictor, textEncoder, vectorEstimator, vocoder });
}

export async function loadVoiceStyle(modelId: string, voice: string): Promise<VoiceStyle> {
  const data = (await modelFile(modelId, voiceFileName(voice)).json()) as VoiceStyleData;
  return buildVoiceStyle(data);
}
