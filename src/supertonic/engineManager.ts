// One shared ONNX engine, resident at a time, keyed by modelId. Sessions hold
// ~300–400 MB of native memory Hermes can't see, so we keep a single instance and
// release it explicitly on a model swap — never under a running inference (route
// inference through withEngine).
import { ensureModelsDownloaded } from './models/modelDownloader';
import type { TextToSpeech } from './synthesis/textToSpeech';
import type { VoiceStyle } from './synthesis/voiceStyle';
import { loadTextToSpeech, loadVoiceStyle } from './textToSpeechLoader';
import { InferenceQueue, type InferencePriority, type InferenceQueueSnapshot } from './inferenceQueue';

type Engine = { modelId: string; tts: TextToSpeech; voices: Map<string, VoiceStyle> };

let engine: Engine | null = null;
// Dedupes concurrent loads of the same model (playback + duration table + prefetch).
let pending: { modelId: string; promise: Promise<Engine> } | null = null;
const inferenceQueue = new InferenceQueue();

let inFlight = 0;
let idleResolvers: Array<() => void> = [];

function noteIdle(): void {
  if (inFlight === 0 && idleResolvers.length > 0) {
    const resolvers = idleResolvers;
    idleResolvers = [];
    resolvers.forEach((r) => r());
  }
}

function waitIdle(): Promise<void> {
  return inFlight === 0 ? Promise.resolve() : new Promise<void>((r) => idleResolvers.push(r));
}

async function loadEngineFor(modelId: string): Promise<Engine> {
  await waitIdle(); // never release under a running inference
  if (engine && engine.modelId !== modelId) {
    const old = engine;
    engine = null;
    try {
      await old.tts.releaseSessions();
    } catch {}
    if (__DEV__) console.log(`[engine] released ${old.modelId}`);
  }
  if (engine?.modelId === modelId) return engine;
  const tts = await loadTextToSpeech(modelId);
  engine = { modelId, tts, voices: new Map() };
  if (__DEV__) console.log(`[engine] loaded ${modelId}`);
  return engine;
}

export async function getEngine(modelId: string): Promise<TextToSpeech> {
  if (engine?.modelId === modelId) return engine.tts;
  if (pending?.modelId === modelId) return (await pending.promise).tts;
  const promise = loadEngineFor(modelId);
  pending = { modelId, promise };
  try {
    return (await promise).tts;
  } finally {
    if (pending?.promise === promise) pending = null;
  }
}

export async function getVoice(modelId: string, voiceId: string): Promise<VoiceStyle> {
  await getEngine(modelId);
  const cached = engine?.modelId === modelId ? engine.voices.get(voiceId) : undefined;
  if (cached) return cached;
  // Other voices' style files may be absent (only the download-time one is fetched).
  await ensureModelsDownloaded(modelId, voiceId);
  const voice = await loadVoiceStyle(modelId, voiceId);
  if (engine?.modelId === modelId) engine.voices.set(voiceId, voice);
  return voice;
}

// Runs inference with in-flight tracking so a model swap waits before releasing.
export function withEngine<T>(
  modelId: string,
  fn: (tts: TextToSpeech) => Promise<T>,
  priority: InferencePriority = 'foreground',
): Promise<T> {
  return inferenceQueue.enqueue(async () => {
    const tts = await getEngine(modelId);
    inFlight++;
    try {
      return await fn(tts);
    } finally {
      inFlight--;
      noteIdle();
    }
  }, priority);
}

export function getInferenceQueueSnapshot(): InferenceQueueSnapshot {
  return inferenceQueue.snapshot();
}

export function isEngineResident(modelId: string): boolean {
  return engine?.modelId === modelId;
}

export async function releaseCurrentEngine(): Promise<void> {
  await waitIdle();
  if (engine) {
    const old = engine;
    engine = null;
    try {
      await old.tts.releaseSessions();
    } catch {}
    if (__DEV__) console.log(`[engine] released ${old.modelId}`);
  }
}
