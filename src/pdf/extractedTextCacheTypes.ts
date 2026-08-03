import type { ExtractedDocument } from './pdfExtractionTypes';

export type ExtractedTextCacheEnvelope = { version: number; doc: ExtractedDocument };
