// One shared ONNX engine, resident at a time, keyed by modelId. Sessions hold
// ~300–400 MB of native memory Hermes can't see, so we keep a single instance
// and release it explicitly on a model swap — never under a running inference.
//
// Every synthesis/prediction the app runs should go through `withEngine` so a
// swap waits for the current run to finish before releasing the old sessions.
import { ensureModelsDownloaded } from './models/modelDownloader';
import type { TextToSpeech } from './synthesis/textToSpeech';
import type { VoiceStyle } from './synthesis/voiceStyle';
import { loadTextToSpeech, loadVoiceStyle } from './textToSpeechLoader';

type Engine = { modelId: string; tts: TextToSpeech; voices: Map<string, VoiceStyle> };

let engine: Engine | null = null;
// Dedupes concurrent loads of the SAME model (playback + duration table + prefetch
// all warm the engine at once when a doc opens).
let pending: { modelId: string; promise: Promise<Engine> } | null = null;

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
  await waitIdle(); // never release the old sessions under a running inference
  if (engine && engine.modelId !== modelId) {
    const old = engine;
    engine = null;
    try {
      await old.tts.releaseSessions();
    } catch {}
    if (__DEV__) console.log(`[engine] released ${old.modelId}`);
  }
  if (engine?.modelId === modelId) return engine; // loaded while we waited
  const tts = await loadTextToSpeech(modelId);
  engine = { modelId, tts, voices: new Map() };
  if (__DEV__) console.log(`[engine] loaded ${modelId}`);
  return engine;
}

/** The resident engine for `modelId`, loading (and releasing any other) as needed. */
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

/** A voice style for the current model, cached per model (styles are cheap JS
 *  buffers; the map dies with the engine). Fetches the style file if missing. */
export async function getVoice(modelId: string, voiceId: string): Promise<VoiceStyle> {
  await getEngine(modelId);
  const cached = engine?.modelId === modelId ? engine.voices.get(voiceId) : undefined;
  if (cached) return cached;
  // Safety-net: only the download-time voice file is fetched up front, so any
  // other voice's ~150 KB style JSON may be missing (model files are skipped).
  await ensureModelsDownloaded(modelId, voiceId);
  const voice = await loadVoiceStyle(modelId, voiceId);
  if (engine?.modelId === modelId) engine.voices.set(voiceId, voice);
  return voice;
}

/** Run an inference on the resident engine with in-flight tracking, so a model
 *  swap waits for it before releasing sessions. */
export async function withEngine<T>(modelId: string, fn: (tts: TextToSpeech) => Promise<T>): Promise<T> {
  const tts = await getEngine(modelId);
  inFlight++;
  try {
    return await fn(tts);
  } finally {
    inFlight--;
    noteIdle();
  }
}

/** True if the given model's engine is already resident (no load needed). */
export function isEngineResident(modelId: string): boolean {
  return engine?.modelId === modelId;
}

/** Release the current engine (e.g. on memory pressure), once it's idle. */
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
