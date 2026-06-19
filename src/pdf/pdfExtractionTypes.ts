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
  | { kind: 'toc'; title: string; target: string; charStart: number; charEnd: number; page: number; indent: number }
  // Running header/footer (recurs across pages). Shown greyed + set apart, never spoken.
  | { kind: 'pageHeader'; text: string; charStart: number; charEnd: number; page: number; indent: number }
  // A raster image (figure/photo) lifted off the page. Carries no spoken text
  // (zero-length char range) so it renders inline but is never narrated. During
  // extraction it arrives as `dataUri` (base64); the RN side writes it to a file
  // and swaps in `uri`.
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
