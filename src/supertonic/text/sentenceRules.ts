// Single source of truth for sentence-boundary + abbreviation rules, shared by
// the chunker, the playback fast-lead splitter, and the document builder. The
// pdf.js extractor (viewer.html) can't import TS, so it keeps a hand-synced copy
// with a pointer back here.

/** ASCII sentence terminators — a match is a boundary ONLY when followed by
 *  whitespace/EOF and not preceded by an abbreviation (callers enforce both).
 *  Global flag: reset `.lastIndex = 0` before each scan (single-threaded, so a
 *  sequential reset is safe). */
export const ASCII_TERMINATORS = /[.!?]+/g;

/** CJK fullwidth terminators — sentence-final unconditionally (CJK has no
 *  post-terminator space convention). Reset `.lastIndex` before each scan. */
export const CJK_TERMINATORS = /[。！？]+/g;

/** Abbreviations that must NOT end a sentence when they precede a `.`. Includes
 *  common scholarly forms (et al., cf., fig., eq., vol.) so "Smith et al. 2019"
 *  stays one sentence. Anchored at end-of-slice by callers. */
export const ABBREVIATION =
  /\b(?:mr|mrs|ms|dr|prof|sr|jr|vs|inc|ltd|co|corp|st|ave|blvd|e\.g|i\.e|etc|al|ca|cf|no|fig|figs|eq|sec|vol|pp|ed|eds|approx)\.$/i;

/** True when `text` is CJK-dominant (Han / Hiragana / Katakana / Hangul). CJK
 *  synthesis quality collapses on long inputs, so these get a shorter chunk cap. */
export function isCjkDominant(sample: string): boolean {
  let cjk = 0;
  let letters = 0;
  for (const ch of sample.slice(0, 2000)) {
    if (/[一-鿿぀-ヿ가-힯]/.test(ch)) {
      cjk++;
      letters++;
    } else if (/\p{L}/u.test(ch)) {
      letters++;
    }
  }
  return letters > 0 && cjk / letters > 0.3;
}

/** Max chunk length in chars: 120 for CJK-dominant text (matches the upstream
 *  Supertonic helper), 300 otherwise. */
export function maxChunkLen(text: string): number {
  return isCjkDominant(text) ? 120 : 300;
}
