// Audio <-> text alignment model: the global char offset into the canonical
// document stream is the join key between text, cached audio, and highlight.

export type TextSpan = {
  charStart: number;
  charEnd: number; // exclusive
  page: number;
  bbox: [number, number, number, number]; // x, y, w, h in PDF user units
};

export type WordTiming = {
  text: string;
  charOffset: number; // global offset into the canonical stream
  tStart: number; // seconds, relative to the chunk audio
  tEnd: number;
};

export type ChunkTiming = {
  chunkIdx: number;
  sampleRate: number;
  words: WordTiming[];
};

export type Chunk = {
  idx: number; // playback order
  charStart: number;
  charEnd: number; // exclusive
  text: string;
  pages: number[];
  textHash: string; // guards cached audio/timing against text drift
};

// A stable, independently cacheable speech unit. Its identity is derived from
// canonical source offsets and text, so it survives changes to chunk grouping.
export type SentenceAnchor = {
  id: string;
  ordinal: number;
  charStart: number;
  charEnd: number; // exclusive
  textHash: string;
};

// Reused on reopen only if docHash AND textHash match — a re-extraction that
// changes the text invalidates the stored chunks.
export type DocumentManifest = {
  docHash: string;
  textHash: string;
  chunkerVersion: number;
  unitLen: number; // chunk unit length (from the quality preset); absent = legacy 300
  chunks: Chunk[];
  sentenceAnchors: SentenceAnchor[];
};
