import type { Chunk, SentenceAnchor } from '../types';

export type SentencePlaybackTarget = {
  sentenceIndex: number;
  canonicalIndex: number;
  nextCanonicalIndex: number;
  anchor: SentenceAnchor;
  chunk: Chunk;
};
