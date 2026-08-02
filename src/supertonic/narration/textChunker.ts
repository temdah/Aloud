import type { Chunk } from '../../types';
import { stableHash } from '../../utils/hash';
import { sentenceBoundaries } from '../text/segmentation';
import { maxChunkLen } from '../text/sentenceRules';

// Groups the canonical document text into playback chunks — whole sentences up to
// a length cap. Each chunk's [charStart, charEnd) stays an exact slice of the
// source; those offsets are the join key between text, cached audio, and highlight.

export type RawChunk = { text: string; charStart: number; charEnd: number };

const STRONG_CLAUSE_ENDS = new Set([';', ':', '\u2014', '\u2013', '\uff1b', '\uff1a']);
const SOFT_CLAUSE_ENDS = new Set([',', '\uff0c', '\u3001']);
const CLOSING_MARKS = new Set(['"', "'", '\u201d', '\u2019', ')', ']', '}', '\uff09', '\u3011', '\u300b', '\u300d', '\u300f']);

export function chunkText(text: string, maxLen = 300): RawChunk[] {
  const limit = Math.max(2, Math.floor(maxLen));
  const ends = sentenceBoundaries(text);
  const chunks: RawChunk[] = [];
  let start = nextNonSpace(text, 0);
  let lastEnd = start;

  for (const end of ends) {
    if (end <= start) continue;
    if (end - start > limit && lastEnd > start) {
      pushRange(chunks, text, start, lastEnd, limit);
      start = nextNonSpace(text, lastEnd);
    }
    lastEnd = end;
  }
  if (text.length > start) pushRange(chunks, text, start, text.length, limit);
  return chunks;
}

export function buildChunks(text: string, unitLen: number): Chunk[] {
  return chunkText(text, maxChunkLen(text, unitLen)).map((c, idx) => ({
    idx,
    charStart: c.charStart,
    charEnd: c.charEnd,
    text: c.text,
    pages: [],
    textHash: stableHash(c.text),
  }));
}

function pushRange(chunks: RawChunk[], text: string, from: number, to: number, maxLen: number): void {
  let charStart = nextNonSpace(text, from);
  let charEnd = to;
  while (charEnd > charStart && /\s/.test(text[charEnd - 1])) charEnd--;

  while (charEnd - charStart > maxLen) {
    const splitAt = semanticSplit(text, charStart, charEnd, maxLen);
    appendChunk(chunks, text, charStart, splitAt);
    charStart = nextNonSpace(text, splitAt);
  }
  appendChunk(chunks, text, charStart, charEnd);
}

function appendChunk(chunks: RawChunk[], text: string, from: number, to: number): void {
  let charEnd = to;
  while (charEnd > from && /\s/.test(text[charEnd - 1])) charEnd--;
  if (charEnd > from) chunks.push({ text: text.slice(from, charEnd), charStart: from, charEnd });
}

// A single sentence can be much longer than the synthesis limit. Choose a
// balanced semantic boundary, falling back from clauses to words and only then
// to a hard cut. The bounds guarantee both this piece and all remaining pieces
// can stay at or below maxLen.
function semanticSplit(text: string, from: number, to: number, maxLen: number): number {
  const remaining = to - from;
  const pieces = Math.ceil(remaining / maxLen);
  const minPiece = Math.max(1, Math.min(80, Math.floor(maxLen * 0.25)));
  const minEnd = Math.max(from + minPiece, to - (pieces - 1) * maxLen);
  const maxEnd = Math.min(from + maxLen, to - minPiece);
  const target = Math.min(maxEnd, Math.max(minEnd, from + Math.round(remaining / pieces)));

  return (
    closestPunctuationBoundary(text, minEnd, maxEnd, target, STRONG_CLAUSE_ENDS) ??
    closestPunctuationBoundary(text, minEnd, maxEnd, target, SOFT_CLAUSE_ENDS) ??
    closestWhitespaceBoundary(text, minEnd, maxEnd, target) ??
    safeHardBoundary(text, target, from)
  );
}

function closestPunctuationBoundary(
  text: string,
  minEnd: number,
  maxEnd: number,
  target: number,
  punctuation: ReadonlySet<string>,
): number | null {
  let closest: number | null = null;
  for (let i = minEnd - 1; i < maxEnd; i++) {
    if (!punctuation.has(text[i])) continue;
    let candidate = i + 1;
    while (candidate < maxEnd && CLOSING_MARKS.has(text[candidate])) candidate++;
    if (candidate < minEnd || candidate > maxEnd) continue;
    if (closest === null || Math.abs(candidate - target) < Math.abs(closest - target)) closest = candidate;
  }
  return closest;
}

function closestWhitespaceBoundary(text: string, minEnd: number, maxEnd: number, target: number): number | null {
  let closest: number | null = null;
  for (let i = minEnd; i <= maxEnd; i++) {
    if (!/\s/.test(text[i])) continue;
    if (closest === null || Math.abs(i - target) < Math.abs(closest - target)) closest = i;
  }
  return closest;
}

function safeHardBoundary(text: string, target: number, from: number): number {
  const previous = text.charCodeAt(target - 1);
  const next = text.charCodeAt(target);
  const splitsSurrogatePair = previous >= 0xd800 && previous <= 0xdbff && next >= 0xdc00 && next <= 0xdfff;
  return splitsSurrogatePair && target - 1 > from ? target - 1 : target;
}

function nextNonSpace(text: string, i: number): number {
  while (i < text.length && /\s/.test(text[i])) i++;
  return i;
}
