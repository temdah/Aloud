import { EngineLifecycle } from './engineLifecycle';
import type { Engine } from './engineManagerTypes';
import { InferenceQueue, type InferencePriority, type InferenceQueueSnapshot } from './inferenceQueue';
import { ensureModelsDownloaded } from './models/modelDownloader';
import type { TextToSpeech } from './synthesis/textToSpeech';
import type { VoiceStyle } from './synthesis/voiceStyle';
import { loadTextToSpeech, loadVoiceStyle } from './textToSpeechLoader';

// Owns the single resident ONNX engine and prevents release during inference.
const inferenceQueue = new InferenceQueue();
const lifecycle = new EngineLifecycle<Engine>({
  load: async (modelId) => {
    const tts = await loadTextToSpeech(modelId);
    if (__DEV__) console.log(`[engine] loaded ${modelId}`);
    return { modelId, tts, voices: new Map() };
  },
  release: async (engine, modelId) => {
    try {
      await engine.tts.releaseSessions();
    } catch {}
    if (__DEV__) console.log(`[engine] released ${modelId}`);
  },
});

export async function getEngine(modelId: string): Promise<TextToSpeech> {
  return (await lifecycle.get(modelId)).tts;
}

export async function getVoice(modelId: string, voiceId: string): Promise<VoiceStyle> {
  const engine = await lifecycle.get(modelId);
  const cached = engine.voices.get(voiceId);
  if (cached) return cached;
  await ensureModelsDownloaded(modelId, voiceId);
  const voice = await loadVoiceStyle(modelId, voiceId);
  engine.voices.set(voiceId, voice);
  return voice;
}

export function withEngine<T>(
  modelId: string,
  fn: (tts: TextToSpeech) => Promise<T>,
  priority: InferencePriority = 'foreground',
): Promise<T> {
  return inferenceQueue.enqueue(() => lifecycle.use(modelId, (engine) => fn(engine.tts)), priority);
}

export function getInferenceQueueSnapshot(): InferenceQueueSnapshot {
  return inferenceQueue.snapshot();
}

export function isEngineResident(modelId: string): boolean {
  return lifecycle.isResident(modelId);
}

export async function releaseCurrentEngine(): Promise<void> {
  await lifecycle.releaseCurrent();
}
