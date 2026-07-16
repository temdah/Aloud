import type { Chunk } from '../../types';
import { stableHash } from '../../utils';
import { ABBREVIATION, ASCII_TERMINATORS, CJK_TERMINATORS, maxChunkLen } from '../text/sentenceRules';

/** A chunk's text plus its char range in the source (canonical) stream. */
export type RawChunk = { text: string; charStart: number; charEnd: number };

// Sentence-aware chunking that PRESERVES char offsets into the source stream,
// so each chunk's [charStart, charEnd) is a verbatim slice of the document. (The
// design's global char offset is the join key, so offsets must be exact.)
// Chunks accumulate whole sentences up to ~maxLen so the synthesized clip is
// long enough to play smoothly (tiny per-sentence clips stutter at boundaries).
// Precise tap-to-start is handled separately by a "lead" chunk in usePlayback.
export function chunkText(text: string, maxLen = 300): RawChunk[] {
  const ends = sentenceBoundaries(text);
  const chunks: RawChunk[] = [];
  let start = nextNonSpace(text, 0);
  let lastEnd = start;

  for (const end of ends) {
    if (end <= start) continue;
    if (end - start > maxLen && lastEnd > start) {
      pushRange(chunks, text, start, lastEnd);
      start = nextNonSpace(text, lastEnd);
    }
    lastEnd = end;
  }
  if (text.length > start) pushRange(chunks, text, start, text.length);
  return chunks;
}

// Builds the canonical chunk list: idx = playback order, with a textHash guard.
// CJK-dominant documents cap at 120 chars (matches upstream); others at 300.
export function buildChunks(text: string): Chunk[] {
  return chunkText(text, maxChunkLen(text)).map((c, idx) => ({
    idx,
    charStart: c.charStart,
    charEnd: c.charEnd,
    text: c.text,
    pages: [],
    textHash: stableHash(c.text),
  }));
}

function pushRange(chunks: RawChunk[], text: string, from: number, to: number): void {
  const charStart = nextNonSpace(text, from);
  let charEnd = to;
  while (charEnd > charStart && /\s/.test(text[charEnd - 1])) charEnd--;
  if (charEnd > charStart) chunks.push({ text: text.slice(charStart, charEnd), charStart, charEnd });
}

function nextNonSpace(text: string, i: number): number {
  while (i < text.length && /\s/.test(text[i])) i++;
  return i;
}

// Positions (exclusive) where a sentence ends or a paragraph breaks.
function sentenceBoundaries(text: string): number[] {
  const result: number[] = [];
  let m: RegExpExecArray | null;
  // ASCII terminators: boundary only when followed by whitespace/EOF, skipping
  // abbreviations.
  ASCII_TERMINATORS.lastIndex = 0;
  while ((m = ASCII_TERMINATORS.exec(text))) {
    const end = m.index + m[0].length;
    if (end < text.length && !/\s/.test(text[end])) continue; // must be followed by whitespace/EOF
    if (ABBREVIATION.test(text.slice(Math.max(0, m.index - 6), m.index + 1))) continue;
    result.push(end);
  }
  // CJK fullwidth terminators: sentence-final unconditionally (no space rule).
  CJK_TERMINATORS.lastIndex = 0;
  while ((m = CJK_TERMINATORS.exec(text))) result.push(m.index + m[0].length);
  const para = /\n\s*\n/g;
  while ((m = para.exec(text))) result.push(m.index);
  return result.sort((a, b) => a - b);
}
