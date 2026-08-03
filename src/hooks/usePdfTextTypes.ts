import type { ReactNode } from 'react';
import type { ExtractedDocument } from '../pdf';

export type PdfTextStatus = 'idle' | 'loading' | 'streaming' | 'ready' | 'error';

export type PdfTextState = {
  status: PdfTextStatus;
  document: ExtractedDocument | null;
  pageCount: number;
  loadedPages: number;
  stage: string;
  error?: string;
  extractor: ReactNode;
};
