import { ensureChunkAudio, ensureLeadAudio, ensureSentenceAudio, getVoice, withEngine } from '../supertonic';
import type { VoiceStyle } from '../supertonic';
import type { Chunk, SentenceAnchor } from '../types';
import type {
  PlaybackSynthesisRequest,
  PlaybackSynthesizerDependencies,
  PlaybackSynthesizerOptions,
} from './playbackSynthesizerTypes';

const defaultDependencies: PlaybackSynthesizerDependencies = {
  getVoice,
  withEngine,
  ensureChunkAudio,
  ensureLeadAudio,
  ensureSentenceAudio,
};

// Owns voice resolution and race-safe synthesis for one playback profile.
export class PlaybackSynthesizer {
  private voicePromise: Promise<VoiceStyle> | null = null;

  constructor(
    private readonly options: PlaybackSynthesizerOptions,
    private readonly dependencies: PlaybackSynthesizerDependencies = defaultDependencies,
  ) {}

  async prepareChunk(
    chunk: Chunk,
    kind: 'canonical' | 'lead',
    request: PlaybackSynthesisRequest = {},
  ): Promise<string | null> {
    const voice = await this.resolveVoice(request.shouldContinue);
    if (!voice) return null;
    const { docHash, documentText, settings } = this.options;
    return this.dependencies.withEngine(
      settings.modelId,
      (tts) => {
        if (request.shouldContinue && !request.shouldContinue()) return Promise.resolve(null);
        return kind === 'lead'
          ? this.dependencies.ensureLeadAudio(tts, voice, docHash, documentText, chunk, settings, request.onMetrics)
          : this.dependencies.ensureChunkAudio(tts, voice, docHash, documentText, chunk, settings, request.onMetrics);
      },
      request.priority ?? 'foreground',
    );
  }

  async prepareSentence(
    anchor: SentenceAnchor,
    request: PlaybackSynthesisRequest = {},
  ): Promise<string | null> {
    const voice = await this.resolveVoice(request.shouldContinue);
    if (!voice) return null;
    const { docHash, documentText, settings } = this.options;
    return this.dependencies.withEngine(
      settings.modelId,
      (tts) => {
        if (request.shouldContinue && !request.shouldContinue()) return Promise.resolve(null);
        return this.dependencies.ensureSentenceAudio(
          tts,
          voice,
          docHash,
          documentText,
          anchor,
          settings,
          request.onMetrics,
        );
      },
      request.priority ?? 'foreground',
    );
  }

  private async resolveVoice(shouldContinue?: () => boolean): Promise<VoiceStyle | null> {
    if (shouldContinue && !shouldContinue()) return null;
    if (!this.voicePromise) {
      const pending = this.dependencies.getVoice(this.options.settings.modelId, this.options.settings.voiceId);
      this.voicePromise = pending;
      void pending.catch(() => {
        if (this.voicePromise === pending) this.voicePromise = null;
      });
    }
    const voice = await this.voicePromise;
    return shouldContinue && !shouldContinue() ? null : voice;
  }
}
