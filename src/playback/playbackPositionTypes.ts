import type { Chunk } from '../types';

export type DocumentPositionInput = {
  singleItem: boolean;
  isLoaded: boolean;
  currentTime: number;
  mediaDuration: number;
  speed: number;
  tableDuration: number;
  offsets: readonly number[] | null;
  durations: readonly number[] | null;
  anchorIndex: number;
  chunks: readonly Chunk[];
  currentChunk: Chunk | null;
};

export type DocumentPosition = {
  positionSec: number;
  durationSec: number;
};
