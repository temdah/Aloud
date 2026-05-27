import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { PdfTextExtractor, loadExtractedText, saveExtractedText } from '../pdf';
import type { ExtractedDocument } from '../pdf';
import { useDocumentsStore } from '../stores';
import { loadChunks } from '../supertonic';
import type { ImportedDocument } from '../types';

export type PdfTextStatus = 'idle' | 'extracting' | 'ready' | 'error';

export type PdfTextState = {
  status: PdfTextStatus;
  document: ExtractedDocument | null;
  /** Current extraction stage, e.g. "page 3/40" (for progress display). */
  stage: string;
  error?: string;
  /** Mount this (hidden) somewhere in the tree while it extracts. */
  extractor: ReactNode;
};

// Resolves a document's reflowed text: reuse the per-doc cache, otherwise run
// the headless PDF.js extractor. On success it also persists the cache, builds
// + persists the chunk manifest, and records the page count on the document.
export function usePdfText(doc: ImportedDocument | undefined): PdfTextState {
  const setPageCount = useDocumentsStore((s) => s.setPageCount);
  const [status, setStatus] = useState<PdfTextStatus>('idle');
  const [document, setDocument] = useState<ExtractedDocument | null>(null);
  const [stage, setStage] = useState('');
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    setError(undefined);
    setStage('');
    if (!doc) {
      setStatus('idle');
      setDocument(null);
      return;
    }
    const cached = loadExtractedText(doc.docHash);
    if (cached) {
      setDocument(cached);
      setStatus('ready');
      return;
    }
    setDocument(null);
    setStatus('extracting');
  }, [doc?.docHash]);

  const onResult = useCallback(
    (extracted: ExtractedDocument) => {
      if (!doc) return;
      saveExtractedText(doc.docHash, extracted);
      try {
        loadChunks(doc.docHash, extracted.text);
      } catch {}
      if (extracted.pageCount > 0) setPageCount(doc.docHash, extracted.pageCount);
      setDocument(extracted);
      setStatus('ready');
    },
    [doc?.docHash, setPageCount],
  );

  const onError = useCallback((message: string) => {
    setError(message);
    setStatus('error');
  }, []);

  const extractor =
    doc && status === 'extracting' ? (
      <PdfTextExtractor
        key={doc.docHash}
        fileUri={doc.fileUri}
        docHash={doc.docHash}
        onResult={onResult}
        onError={onError}
        onStatus={setStage}
      />
    ) : null;

  return { status, document, stage, error, extractor };
}
