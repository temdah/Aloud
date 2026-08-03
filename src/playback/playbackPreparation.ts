import {
  chunkAudioUri,
  isChunkCached,
  isLeadCached,
  isSentenceCached,
  leadAudioFile,
  sentenceAudioUri,
} from '../supertonic';
import type { Chunk, SentenceAnchor } from '../types';
import type {
  PlaybackPreparationDependencies,
  PlaybackPreparationOptions,
  PlaybackPreparationRequest,
  PreparedPlaybackClip,
} from './playbackPreparationTypes';

const defaultDependencies: PlaybackPreparationDependencies = {
  isChunkCached,
  isLeadCached,
  isSentenceCached,
  chunkAudioUri,
  leadAudioFile,
  sentenceAudioUri,
};

// Resolves cache hits and synthesis into one player-ready clip contract.
export class PlaybackPreparation {
  constructor(
    private readonly options: PlaybackPreparationOptions,
    private readonly dependencies: PlaybackPreparationDependencies = defaultDependencies,
  ) {}

  async prepareChunk(
    chunk: Chunk,
    kind: 'canonical' | 'lead',
    request: PlaybackPreparationRequest,
  ): Promise<PreparedPlaybackClip | null> {
    const { docHash, settings, synthesizer } = this.options;
    const cached = kind === 'lead'
      ? this.dependencies.isLeadCached(docHash, chunk.charStart, chunk.text.length, settings)
      : this.dependencies.isChunkCached(docHash, chunk.charStart, settings);
    request.onDecision(
      cached
        ? (kind === 'lead' ? 'lead-cache' : 'canonical-cache')
        : (kind === 'lead' ? 'lead-synthesis' : 'canonical-synthesis'),
      cached,
    );
    const preparationStartedAt = Date.now();
    if (cached) {
      return {
        uri: kind === 'lead'
          ? this.dependencies.leadAudioFile(docHash, chunk.charStart, chunk.text.length, settings).uri
          : this.dependencies.chunkAudioUri(docHash, chunk.charStart, settings),
        preparationStartedAt,
        metrics: null,
      };
    }

    let metrics = null;
    const uri = await synthesizer.prepareChunk(chunk, kind, {
      shouldContinue: request.shouldContinue,
      onMetrics: (reported) => { metrics = reported; },
    });
    return uri ? { uri, preparationStartedAt, metrics } : null;
  }

  async prepareSentence(
    anchor: SentenceAnchor,
    request: PlaybackPreparationRequest,
  ): Promise<PreparedPlaybackClip | null> {
    const { docHash, settings, synthesizer } = this.options;
    const cached = this.dependencies.isSentenceCached(docHash, anchor, settings);
    request.onDecision(cached ? 'sentence-cache' : 'sentence-synthesis', cached);
    const preparationStartedAt = Date.now();
    if (cached) {
      return {
        uri: this.dependencies.sentenceAudioUri(docHash, anchor, settings),
        preparationStartedAt,
        metrics: null,
      };
    }

    let metrics = null;
    const uri = await synthesizer.prepareSentence(anchor, {
      shouldContinue: request.shouldContinue,
      onMetrics: (reported) => { metrics = reported; },
    });
    return uri ? { uri, preparationStartedAt, metrics } : null;
  }
}
