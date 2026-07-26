import type { Chunk } from '../../types';
import { stableHash } from '../../utils';
import { ABBREVIATION, ASCII_TERMINATORS, CJK_TERMINATORS, maxChunkLen } from '../text/sentenceRules';

// Groups the canonical document text into playback chunks — whole sentences up to
// a length cap. Each chunk's [charStart, charEnd) stays an exact slice of the
// source; those offsets are the join key between text, cached audio, and highlight.

export type RawChunk = { text: string; charStart: number; charEnd: number };

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

// Exclusive char positions where a sentence or paragraph ends. ASCII .?! count
// only when followed by whitespace and not part of an abbreviation; CJK 。！？ and
// blank lines always do.
function sentenceBoundaries(text: string): number[] {
  const result: number[] = [];
  let m: RegExpExecArray | null;
  ASCII_TERMINATORS.lastIndex = 0;
  while ((m = ASCII_TERMINATORS.exec(text))) {
    const end = m.index + m[0].length;
    if (end < text.length && !/\s/.test(text[end])) continue;
    if (ABBREVIATION.test(text.slice(Math.max(0, m.index - 6), m.index + 1))) continue;
    result.push(end);
  }
  CJK_TERMINATORS.lastIndex = 0;
  while ((m = CJK_TERMINATORS.exec(text))) result.push(m.index + m[0].length);
  const para = /\n\s*\n/g;
  while ((m = para.exec(text))) result.push(m.index);
  return result.sort((a, b) => a - b);
}
