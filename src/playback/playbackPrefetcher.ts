import { getDevicePerformanceSnapshot } from '../../modules/device-performance';
import { getSynthRtf, isChunkCached, isSentenceCached } from '../supertonic';
import type { Chunk, SentenceAnchor } from '../types';
import { recordPrefetchDepth } from './playbackMetrics';
import { classifyDevicePressure, prefetchDepth } from './playbackPlanning';
import type {
  CanonicalPrefetchRequest,
  PlaybackPrefetcherDependencies,
  PlaybackPrefetcherOptions,
  SentencePrefetchRequest,
} from './playbackPrefetcherTypes';
import { sentenceTargetAtIndex } from './sentencePlayback';

const defaultDependencies: PlaybackPrefetcherDependencies = {
  getDevicePerformanceSnapshot,
  getSynthRtf,
  isChunkCached,
  isSentenceCached,
  classifyDevicePressure,
  prefetchDepth,
  recordPrefetchDepth,
};

// Builds a device-aware audio buffer without competing with foreground playback.
export class PlaybackPrefetcher {
  constructor(
    private readonly options: PlaybackPrefetcherOptions,
    private readonly dependencies: PlaybackPrefetcherDependencies = defaultDependencies,
  ) {}

  async prefetchCanonical(request: CanonicalPrefetchRequest): Promise<void> {
    const { chunks, startIndex, immediate, enclosing, shouldContinue } = request;
    if (immediate) await this.prepareChunk(immediate, shouldContinue);
    if (!shouldContinue()) return;

    const depth = this.resolveDepth();
    for (let offset = 0; offset < depth; offset++) {
      if (!shouldContinue()) return;
      const chunk = chunks[startIndex + offset];
      if (!chunk) return;
      await this.prepareChunk(chunk, shouldContinue);
    }

    if (enclosing && shouldContinue()) await this.prepareChunk(enclosing, shouldContinue);
  }

  async prefetchSentences(request: SentencePrefetchRequest): Promise<void> {
    const { plan, startIndex, shouldContinue } = request;
    const depth = this.resolveDepth();
    for (let offset = 0; offset < depth; offset++) {
      if (!shouldContinue()) return;
      const target = sentenceTargetAtIndex(plan, startIndex + offset);
      if (!target) return;
      await this.prepareSentence(target.anchor, shouldContinue);
    }
  }

  private resolveDepth(): number {
    const { settings } = this.options;
    const throughput = this.dependencies.getSynthRtf(settings.modelId);
    const pressure = this.dependencies.classifyDevicePressure(
      this.dependencies.getDevicePerformanceSnapshot(),
    );
    const depth = this.dependencies.prefetchDepth(throughput, pressure);
    this.dependencies.recordPrefetchDepth(depth, throughput);
    return depth;
  }

  private async prepareChunk(chunk: Chunk, shouldContinue: () => boolean): Promise<void> {
    const { docHash, settings, synthesizer } = this.options;
    if (!shouldContinue() || this.dependencies.isChunkCached(docHash, chunk.charStart, settings)) return;
    try {
      await synthesizer.prepareChunk(chunk, 'canonical', {
        priority: 'background',
        shouldContinue,
      });
    } catch {}
  }

  private async prepareSentence(anchor: SentenceAnchor, shouldContinue: () => boolean): Promise<void> {
    const { docHash, settings, synthesizer } = this.options;
    if (!shouldContinue() || this.dependencies.isSentenceCached(docHash, anchor, settings)) return;
    try {
      await synthesizer.prepareSentence(anchor, {
        priority: 'background',
        shouldContinue,
      });
    } catch {}
  }
}
