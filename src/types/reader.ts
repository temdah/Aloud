// Shape of reader page content. Real instances come from the PDF.js -> RN
// sentence bridge; the app ships with no sample content.

export type PageBlock =
  | { kind: 'h2'; text: string }
  | { kind: 'p'; sentences: string[] };
