import type { Chunk } from '../../types';
import type { NarrationSettings } from './narrationTypes';

export type PrerenderProgress = { done: number; total: number };

export type PrerenderResult = { completed: boolean; done: number };

export type PrerenderOptions = {
  docHash: string;
  chunks: Chunk[];
  settings: NarrationSettings;
  ensureAudio: (chunk: Chunk) => Promise<void>;
  onProgress?: (progress: PrerenderProgress) => void;
  shouldCancel?: () => boolean;
};
