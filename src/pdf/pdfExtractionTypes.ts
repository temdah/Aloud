// Output of the PDF.js text-extraction pass. All char offsets index into the
// canonical `text` stream (the same string fed to buildChunks), so a tapped
// sentence resolves to a chunk by char offset.

export type ExtractedSentence = {
  text: string;
  charStart: number;
  charEnd: number; // exclusive
};

// indent = hierarchy depth (0 = left margin), recovered from the line's x-position.
export type ExtractedBlock =
  | { kind: 'h2'; text: string; charStart: number; charEnd: number; page: number; indent: number }
  | { kind: 'p'; sentences: ExtractedSentence[]; charStart: number; charEnd: number; page: number; indent: number }
  | { kind: 'toc'; title: string; target: string; charStart: number; charEnd: number; page: number; indent: number }
  // Running header/footer: shown greyed and set apart, never spoken.
  | { kind: 'pageHeader'; text: string; charStart: number; charEnd: number; page: number; indent: number }
  // A raster image lifted off the page — zero-length char range so it renders
  // inline but is never narrated. Arrives as base64 `dataUri`; the RN side writes
  // a file and swaps in `uri`.
  | {
      kind: 'image';
      uri?: string;
      dataUri?: string;
      width: number;
      height: number;
      charStart: number;
      charEnd: number;
      page: number;
      indent: number;
    };

export type ExtractedDocument = {
  text: string; // canonical reading-order text; chunk/sentence offsets index into it
  blocks: ExtractedBlock[];
  pageCount: number;
};

// Streamed from the extraction WebView: meta (page count) first, one page per
// message as it's extracted, then done.
export type ExtractionMessage =
  | { type: 'status'; stage: string }
  | { type: 'meta'; pageCount: number }
  | { type: 'page'; page: number; blocks: ExtractedBlock[]; textSegment: string }
  | { type: 'done' }
  | { type: 'error'; message: string };
