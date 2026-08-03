import type { Chunk } from '../../types';
import { buildSentenceAnchors } from './sentenceAnchors';
import type { NarrationPlan } from './narrationPlanTypes';

export const EMPTY_NARRATION_PLAN: NarrationPlan = {
  text: '',
  chunks: [],
  sentences: [],
};

export function createNarrationPlan(text: string, chunks: Chunk[]): NarrationPlan {
  return {
    text,
    chunks,
    sentences: buildSentenceAnchors(text),
  };
}
