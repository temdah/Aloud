import type { Chunk } from '../../types';
import { sentenceSpans } from '../text/segmentation';
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
    sentences: sentenceSpans(text),
  };
}
