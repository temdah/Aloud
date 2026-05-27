// Output of the PDF.js text-extraction pass. All char offsets index into the
// canonical `text` stream — the same string fed to buildChunks — so a tapped
// sentence resolves to a chunk by char offset (see audio↔text alignment, §10).

export type ExtractedSentence = {
  text: string;
  charStart: number;
  charEnd: number; // exclusive
};

// indent = hierarchy depth (0 = left margin) recovered from line x-position.
export type ExtractedBlock =
  | { kind: 'h2'; text: string; charStart: number; charEnd: number; page: number; indent: number }
  | { kind: 'p'; sentences: ExtractedSentence[]; charStart: number; charEnd: number; page: number; indent: number }
  | { kind: 'toc'; title: string; target: string; charStart: number; charEnd: number; page: number; indent: number };

export type ExtractedDocument = {
  /** Canonical reading-order text. Chunk/sentence offsets index into this. */
  text: string;
  blocks: ExtractedBlock[];
  pageCount: number;
};

// Messages streamed from the extraction WebView back to React Native: the page
// count arrives first, then one message per page as it is extracted, then done.
export type ExtractionMessage =
  | { type: 'status'; stage: string }
  | { type: 'meta'; pageCount: number }
  | { type: 'page'; page: number; blocks: ExtractedBlock[]; textSegment: string }
  | { type: 'done' }
  | { type: 'error'; message: string };
