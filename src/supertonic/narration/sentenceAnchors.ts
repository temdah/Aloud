import type { SentenceAnchor } from '../../types';
import { stableHash } from '../../utils/hash';
import { sentenceSpans } from '../text/segmentation';
import { chunkText } from './textChunker';

// Independent of playback quality: changing canonical chunk size must not alter
// the units that identify reusable sentence audio. Oversized sentences are
// deterministically capped to protect synthesis quality and memory use.
export const MAX_SENTENCE_ANCHOR_CHARS = 120;
const SENTENCE_ANCHOR_VERSION = 2;

export function sentenceAnchorId(charStart: number, charEnd: number, textHash: string): string {
  return `s${SENTENCE_ANCHOR_VERSION}-${charStart}-${charEnd}-${textHash}`;
}

export function buildSentenceAnchors(text: string): SentenceAnchor[] {
  const anchors: SentenceAnchor[] = [];

  for (const sentence of sentenceSpans(text)) {
    const sentenceText = text.slice(sentence.charStart, sentence.charEnd);
    const parts = chunkText(sentenceText, MAX_SENTENCE_ANCHOR_CHARS);
    for (const part of parts) {
      const charStart = sentence.charStart + part.charStart;
      const charEnd = sentence.charStart + part.charEnd;
      const textHash = stableHash(text.slice(charStart, charEnd));
      anchors.push({
        id: sentenceAnchorId(charStart, charEnd, textHash),
        ordinal: anchors.length,
        charStart,
        charEnd,
        textHash,
      });
    }
  }

  return anchors;
}
