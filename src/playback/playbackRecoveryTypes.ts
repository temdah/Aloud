import type { NarrationPlan, NarrationSettings } from '../supertonic';
import type { Chunk } from '../types';
import type { Lead } from './playbackPlanningTypes';

export type RecoverableClip =
  | { kind: 'sentence'; key: string; sentenceIndex: number }
  | {
      kind: 'canonical';
      key: string;
      chunk: Chunk;
      anchorIdx: number;
      resumeIdx: number;
      lead: boolean;
      next: Lead | null;
    }
  | { kind: 'audiobook'; key: string };

export type PlaybackRecoveryContext = {
  docHash: string;
  plan: NarrationPlan;
  chunks: readonly Chunk[];
  settings: NarrationSettings;
  currentChunkIndex: number;
};

export type PlaybackRecoveryAction =
  | { kind: 'missing'; message: string }
  | { kind: 'exhausted'; message: string }
  | { kind: 'sentence'; sentenceIndex: number }
  | { kind: 'canonical'; clip: Extract<RecoverableClip, { kind: 'canonical' }> }
  | { kind: 'audiobook'; fallbackIndex: number | null };

export type PlaybackRecoveryDependencies = {
  deleteSentenceCache: typeof import('../supertonic').deleteSentenceCache;
  deleteChunkCache: typeof import('../supertonic').deleteChunkCache;
  deleteLeadCache: typeof import('../supertonic').deleteLeadCache;
  deleteAudiobookCache: typeof import('../supertonic').deleteAudiobookCache;
};
