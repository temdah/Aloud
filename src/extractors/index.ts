// Pure-JS extractors for non-PDF formats (same ExtractedDocument shape as PDF).
export { buildDocument } from './documentBuilder';
export { extractMarkdown } from './markdownExtractor';
export { extractDocx } from './docxExtractor';
export { kindForName, extensionForKind } from './fileKind';
