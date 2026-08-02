import type { Chunk, SentenceAnchor } from '../../types';

// Canonical document input shared by the reader and playback. Keeping text,
// chunks, and sentence offsets together prevents consumers from mixing data
// produced from different document revisions or chunking settings.
export type NarrationPlan = {
  text: string;
  chunks: Chunk[];
  sentences: SentenceAnchor[];
};
