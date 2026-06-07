// Pure-JS extractors for non-PDF formats. Each emits the same ExtractedDocument
// shape the reader + chunker consume (PDF gets that from headless PDF.js).
export { buildDocument } from './documentBuilder';
export { extractMarkdown } from './markdownExtractor';
export { extractDocx } from './docxExtractor';
export { kindForName, extensionForKind } from './fileKind';
