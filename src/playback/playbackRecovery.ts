import { deleteAudiobookCache, deleteChunkCache, deleteLeadCache, deleteSentenceCache } from '../supertonic';
import { PlaybackRecoveryGate } from './playbackRecoveryGate';
import type {
  PlaybackRecoveryAction,
  PlaybackRecoveryContext,
  PlaybackRecoveryDependencies,
  RecoverableClip,
} from './playbackRecoveryTypes';
import { sentenceTargetAtIndex } from './sentencePlayback';

const defaultDependencies: PlaybackRecoveryDependencies = {
  deleteSentenceCache,
  deleteChunkCache,
  deleteLeadCache,
  deleteAudiobookCache,
};

// Invalidates one failed cache entry and permits one automatic rebuild per clip.
export class PlaybackRecoveryController {
  private readonly gate = new PlaybackRecoveryGate();

  constructor(private readonly dependencies: PlaybackRecoveryDependencies = defaultDependencies) {}

  recover(
    clip: RecoverableClip | null,
    context: PlaybackRecoveryContext,
    userInitiated = false,
  ): PlaybackRecoveryAction {
    if (!clip) {
      return { kind: 'missing', message: 'Playback failed before an audio section could be identified.' };
    }
    if (userInitiated) this.gate.reset(clip.key);
    if (!this.gate.claim(clip.key)) {
      return { kind: 'exhausted', message: 'Audio still could not be played after rebuilding this section.' };
    }

    const { docHash, plan, chunks, settings, currentChunkIndex } = context;
    if (clip.kind === 'sentence') {
      const target = sentenceTargetAtIndex(plan, clip.sentenceIndex);
      if (!target) return { kind: 'missing', message: 'The sentence is no longer available for playback.' };
      this.dependencies.deleteSentenceCache(docHash, target.anchor, settings);
      return { kind: 'sentence', sentenceIndex: clip.sentenceIndex };
    }
    if (clip.kind === 'canonical') {
      if (clip.lead) {
        this.dependencies.deleteLeadCache(docHash, clip.chunk.charStart, clip.chunk.text.length, settings);
      } else {
        this.dependencies.deleteChunkCache(docHash, clip.chunk.charStart, settings);
      }
      return { kind: 'canonical', clip };
    }

    this.dependencies.deleteAudiobookCache(docHash, settings);
    const fallbackIndex = chunks.length === 0
      ? null
      : Math.max(0, Math.min(currentChunkIndex, chunks.length - 1));
    return { kind: 'audiobook', fallbackIndex };
  }

  clear(): void {
    this.gate.clear();
  }
}
