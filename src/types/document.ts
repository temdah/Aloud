// Audio <-> text alignment model (see docs/audio-text-alignment).
// The global char offset into the canonical document stream is the universal
// join key between every artifact here.

/** Map A entry: a PDF text item's char range and where it sits on a page. */
export type TextSpan = {
  charStart: number;
  charEnd: number; // exclusive
  page: number;
  bbox: [number, number, number, number]; // x, y, w, h in PDF user units
};

/** A word's timing within a chunk (Map B), times relative to the chunk audio. */
export type WordTiming = {
  text: string;
  charOffset: number; // global offset
  tStart: number; // seconds
  tEnd: number; // seconds
};

/** Map B: time -> text for one synthesized chunk (cached beside the WAV). */
export type ChunkTiming = {
  chunkIdx: number;
  sampleRate: number;
  words: WordTiming[];
};

/** A chunk = a char range in the canonical stream. idx = playback order. */
export type Chunk = {
  idx: number;
  charStart: number;
  charEnd: number; // exclusive
  text: string;
  pages: number[]; // [] until known from the PDF text layer
  textHash: string; // guards cached audio/timing against drift (§7.2)
};

/** Persisted per-document chunk list. Reused on reopen only if docHash AND
 *  textHash match — a re-extraction that changes the text invalidates it. */
export type DocumentManifest = {
  docHash: string;
  /** stableHash of the canonical text the chunks were built from. */
  textHash: string;
  /** Bumped when the chunker algorithm changes; invalidates stored chunks. */
  chunkerVersion: number;
  chunks: Chunk[];
};
