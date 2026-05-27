import type { Chunk } from '../../types';
import { stableHash } from '../../utils';

/** A chunk's text plus its char range in the source (canonical) stream. */
export type RawChunk = { text: string; charStart: number; charEnd: number };

const ABBREVIATION = /\b(?:mr|mrs|ms|dr|prof|sr|jr|vs|inc|ltd|co|corp|st|ave|blvd|e\.g|i\.e|etc)\.$/i;

// Sentence-aware chunking that PRESERVES char offsets into the source stream,
// so each chunk's [charStart, charEnd) is a verbatim slice of the document.
// (The design's global char offset is the join key, so offsets must be exact.)
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
export function buildChunks(text: string): Chunk[] {
  return chunkText(text).map((c, idx) => ({
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
  const sentence = /[.!?]+/g;
  let m: RegExpExecArray | null;
  while ((m = sentence.exec(text))) {
    const end = m.index + m[0].length;
    if (end < text.length && !/\s/.test(text[end])) continue; // must be followed by whitespace/EOF
    if (ABBREVIATION.test(text.slice(Math.max(0, m.index - 6), m.index + 1))) continue;
    result.push(end);
  }
  const para = /\n\s*\n/g;
  while ((m = para.exec(text))) result.push(m.index);
  return result.sort((a, b) => a - b);
}
