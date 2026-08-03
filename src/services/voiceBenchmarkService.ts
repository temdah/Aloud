import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { File, Paths } from 'expo-file-system';
import {
  DEFAULT_VOICE,
  encodeWav,
  getEngine,
  getVoice,
  isEngineResident,
  releaseCurrentEngine,
  withEngine,
  type TextToSpeech,
  type VoiceStyle,
} from '../supertonic';
import { traceMark, traceStart, traceStop } from '../utils';
import type { ColdLoadBenchmark, VoiceBenchmarkConfig, VoiceChunkBenchmark, VoicePlaybackBenchmark } from './voiceBenchmarkTypes';

const OUTPUT_FILE = 'tts_perf_output.wav';
export const VOICE_PLAYBACK_TIMEOUT_MS = 5000;

export class VoiceBenchmarkService {
  private textToSpeech: TextToSpeech | null = null;
  private voice: VoiceStyle | null = null;
  private engineProfile: string | null = null;
  private player: AudioPlayer | null = null;

  async ensureLoaded(config: VoiceBenchmarkConfig, append: (line: string) => void): Promise<void> {
    const modelId = requireModel(config.modelId);
    const voiceId = config.voiceId || DEFAULT_VOICE;
    const profile = `${modelId}:${voiceId}`;
    if (isEngineResident(modelId) && this.engineProfile === profile && this.textToSpeech && this.voice) {
      append('Sessions already loaded (warm) — skipping cold load.');
      return;
    }

    const resident = isEngineResident(modelId);
    append(resident
      ? `Attaching to resident ONNX sessions (${modelId}, voice ${voiceId})...`
      : `Cold-loading ONNX sessions (${modelId}, voice ${voiceId})...`);
    const start = Date.now();
    this.textToSpeech = await getEngine(modelId);
    this.voice = await getVoice(modelId, voiceId);
    this.engineProfile = profile;
    append(`  ${resident ? 'attached' : 'sessions loaded'} in ${((Date.now() - start) / 1000).toFixed(2)} s  (sampleRate=${this.textToSpeech.sampleRate}).`);
  }

  async benchmarkChunk(text: string, config: VoiceBenchmarkConfig): Promise<VoiceChunkBenchmark> {
    const modelId = requireModel(config.modelId);
    if (!this.voice) throw new Error('Voice benchmark is not loaded.');
    const stages: Record<string, number> = {};
    const stepStarts: number[] = [];
    let last = Date.now();
    const synthStart = last;

    const { waveform, durationsSec, diagnostics, sampleRate } = await withEngine(modelId, async (textToSpeech) => ({
      ...(await textToSpeech.synthesize(
        text,
        config.language,
        this.voice!,
        config.steps,
        1,
        () => stepStarts.push(Date.now()),
        (stage) => {
          const now = Date.now();
          stages[stage] = now - last;
          last = now;
          traceMark(stage);
        },
      )),
      sampleRate: textToSpeech.sampleRate,
    }));
    const synthMs = Date.now() - synthStart;

    const encodeStart = Date.now();
    const bytes = encodeWav(waveform, sampleRate);
    const encodeMs = Date.now() - encodeStart;
    const writeStart = Date.now();
    const output = new File(Paths.document, OUTPUT_FILE);
    if (output.exists) output.delete();
    output.create();
    output.write(bytes);

    return {
      stages,
      stepStarts,
      synthMs,
      encodeMs,
      writeMs: Date.now() - writeStart,
      audioSec: waveform.length / sampleRate,
      predictedSec: durationsSec[0] ?? 0,
      diagnostics,
      uri: output.uri,
    };
  }

  async play(uri: string): Promise<VoicePlaybackBenchmark> {
    const start = Date.now();
    await setAudioModeAsync({ playsInSilentMode: true });
    const audioSessionMs = Date.now() - start;
    const createStart = Date.now();
    this.player?.remove?.();
    this.player = createAudioPlayer(uri);
    const player = this.player;
    const createMs = Date.now() - createStart;
    let loadedMs: number | null = player.isLoaded ? Date.now() - start : null;

    return new Promise((resolve) => {
      let settled = false;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      let subscription: { remove: () => void } | null = null;
      const finish = (playingMs: number | null, timedOut: boolean) => {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        subscription?.remove();
        resolve({ audioSessionMs, createMs, loadedMs, playingMs, timedOut });
      };
      subscription = player.addListener('playbackStatusUpdate', (status) => {
        const elapsed = Date.now() - start;
        if (status.isLoaded && loadedMs == null) loadedMs = elapsed;
        if (status.error) finish(null, false);
        else if (status.playing) finish(elapsed, false);
      });
      timeout = setTimeout(() => finish(null, true), VOICE_PLAYBACK_TIMEOUT_MS);
      player.play();
    });
  }

  getLoadedVoice(): VoiceStyle {
    if (!this.voice) throw new Error('Voice benchmark is not loaded.');
    return this.voice;
  }

  async coldLoad(config: VoiceBenchmarkConfig): Promise<ColdLoadBenchmark> {
    const modelId = requireModel(config.modelId);
    await releaseCurrentEngine();
    this.textToSpeech = null;
    this.voice = null;
    this.engineProfile = null;
    traceStart();
    const start = Date.now();
    this.textToSpeech = await getEngine(modelId);
    this.voice = await getVoice(modelId, config.voiceId || DEFAULT_VOICE);
    this.engineProfile = `${modelId}:${config.voiceId || DEFAULT_VOICE}`;
    return { totalMs: Date.now() - start, spans: traceStop() };
  }

  dispose(): void {
    this.player?.remove?.();
    this.player = null;
  }
}

function requireModel(modelId: string | null): string {
  if (!modelId) throw new Error('No voice model selected — pick one in Settings → Voice model.');
  return modelId;
}
