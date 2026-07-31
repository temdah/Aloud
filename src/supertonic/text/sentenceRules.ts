// Sentence-boundary + abbreviation rules, shared by the chunker, playback
// fast-lead, and document builder. viewer.html keeps a hand-synced copy.

// Reset .lastIndex before each scan (module-level global regexes).
export const ASCII_TERMINATORS = /[.!?]+/g;
export const CJK_TERMINATORS = /[。！？]+/g;

// Scholarly forms included (et al., cf., fig.) so "Smith et al. 2019" stays one sentence.
export const ABBREVIATION =
  /\b(?:mr|mrs|ms|dr|prof|sr|jr|vs|inc|ltd|co|corp|st|ave|blvd|e\.g|i\.e|etc|al|ca|cf|no|fig|figs|eq|sec|vol|pp|ed|eds|approx)\.$/i;

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

// CJK synthesis degrades on long inputs, so cap it shorter than the requested
// unit length regardless of the chosen quality preset (matches upstream helper).
export function maxChunkLen(text: string, unitLen: number): number {
  return isCjkDominant(text) ? Math.min(unitLen, 120) : unitLen;
}
