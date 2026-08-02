import { findChunkIndexForOffset } from '../supertonic';
import type { NarrationPlan } from '../supertonic';
import type { SentenceAnchor } from '../types';
import type { SentencePlaybackTarget } from './sentencePlaybackTypes';

export function findSentenceIndexForOffset(sentences: readonly SentenceAnchor[], charOffset: number): number {
  let low = 0;
  let high = sentences.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (sentences[middle].charEnd <= charOffset) low = middle + 1;
    else high = middle;
  }
  return low < sentences.length ? low : -1;
}

export function sentenceTargetAtIndex(plan: NarrationPlan, sentenceIndex: number): SentencePlaybackTarget | null {
  const anchor = plan.sentences[sentenceIndex];
  if (!anchor) return null;
  const canonicalIndex = findChunkIndexForOffset(plan.chunks, anchor.charStart);
  if (canonicalIndex < 0) return null;
  const canonical = plan.chunks[canonicalIndex];
  const nextCanonicalIndex = findChunkIndexForOffset(plan.chunks, anchor.charEnd);
  return {
    sentenceIndex,
    canonicalIndex,
    nextCanonicalIndex: nextCanonicalIndex < 0 ? plan.chunks.length : nextCanonicalIndex,
    anchor,
    chunk: {
      idx: canonical.idx,
      charStart: anchor.charStart,
      charEnd: anchor.charEnd,
      text: plan.text.slice(anchor.charStart, anchor.charEnd),
      pages: canonical.pages,
      textHash: anchor.textHash,
    },
  };
}

// Exact sentence starts and whitespace immediately before a sentence are safe
// reusable starts. A true mid-sentence offset must retain the legacy partial-
// lead path so playback never repeats words before the requested position.
export function sentenceTargetForStart(plan: NarrationPlan, charOffset: number): SentencePlaybackTarget | null {
  const sentenceIndex = findSentenceIndexForOffset(plan.sentences, charOffset);
  if (sentenceIndex < 0) return null;
  const anchor = plan.sentences[sentenceIndex];
  if (charOffset > anchor.charStart) return null;
  return sentenceTargetAtIndex(plan, sentenceIndex);
}
