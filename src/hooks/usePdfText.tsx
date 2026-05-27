import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { PdfTextExtractor, loadExtractedText, saveExtractedText } from '../pdf';
import type { ExtractedBlock, ExtractedDocument } from '../pdf';
import { useDocumentsStore } from '../stores';
import { loadChunks } from '../supertonic';
import type { ImportedDocument } from '../types';

export type PdfTextStatus = 'idle' | 'loading' | 'streaming' | 'ready' | 'error';

export type PdfTextState = {
  status: PdfTextStatus;
  /** Partial while streaming, complete once ready. */
  document: ExtractedDocument | null;
  /** Total pages (known after the first message). */
  pageCount: number;
  /** Pages whose text has arrived so far. */
  loadedPages: number;
  stage: string;
  error?: string;
  /** Mount this (hidden) somewhere in the tree while it extracts. */
  extractor: ReactNode;
};

type State = {
  status: PdfTextStatus;
  document: ExtractedDocument | null;
  pageCount: number;
  loadedPages: number;
  stage: string;
  error?: string;
};

const IDLE: State = { status: 'idle', document: null, pageCount: 0, loadedPages: 0, stage: '' };

// Resolves a document's reflowed text: reuse the per-doc cache, otherwise run
// the headless PDF.js extractor, which streams pages back so the reader can
// show page 1 immediately. On completion it persists the cache, builds the
// chunk manifest, and records the page count.
export function usePdfText(doc: ImportedDocument | undefined): PdfTextState {
  const setPageCount = useDocumentsStore((s) => s.setPageCount);
  const [state, setState] = useState<State>(IDLE);
  const blocksRef = useRef<ExtractedBlock[]>([]);
  const textRef = useRef('');
  const pageCountRef = useRef(0);

  useEffect(() => {
    if (!doc) {
      setState(IDLE);
      return;
    }
    const cached = loadExtractedText(doc.docHash);
    if (cached) {
      setState({ status: 'ready', document: cached, pageCount: cached.pageCount, loadedPages: cached.pageCount, stage: '' });
      return;
    }
    blocksRef.current = [];
    textRef.current = '';
    pageCountRef.current = 0;
    setState({ ...IDLE, status: 'loading' });
  }, [doc?.docHash]);

  const onMeta = useCallback((pageCount: number) => {
    pageCountRef.current = pageCount;
    setState((s) => ({ ...s, status: 'streaming', pageCount, document: { text: '', blocks: [], pageCount } }));
  }, []);

  const onPage = useCallback((page: number, blocks: ExtractedBlock[], textSegment: string) => {
    blocksRef.current = blocksRef.current.concat(blocks);
    textRef.current += textSegment;
    setState((s) => ({
      ...s,
      status: 'streaming',
      loadedPages: page,
      document: { text: textRef.current, blocks: blocksRef.current, pageCount: pageCountRef.current },
    }));
  }, []);

  const onDone = useCallback(() => {
    if (!doc) return;
    const finalDoc: ExtractedDocument = {
      text: textRef.current.replace(/\s+$/, ''),
      blocks: blocksRef.current,
      pageCount: pageCountRef.current,
    };
    saveExtractedText(doc.docHash, finalDoc);
    try {
      loadChunks(doc.docHash, finalDoc.text);
    } catch {}
    if (finalDoc.pageCount > 0) setPageCount(doc.docHash, finalDoc.pageCount);
    setState({ status: 'ready', document: finalDoc, pageCount: finalDoc.pageCount, loadedPages: finalDoc.pageCount, stage: '' });
  }, [doc?.docHash, setPageCount]);

  const onError = useCallback((message: string) => setState((s) => ({ ...s, status: 'error', error: message })), []);
  const onStatus = useCallback((stage: string) => setState((s) => ({ ...s, stage })), []);

  const extractor =
    doc && (state.status === 'loading' || state.status === 'streaming') ? (
      <PdfTextExtractor
        key={doc.docHash}
        fileUri={doc.fileUri}
        docHash={doc.docHash}
        onMeta={onMeta}
        onPage={onPage}
        onDone={onDone}
        onError={onError}
        onStatus={onStatus}
      />
    ) : null;

  return {
    status: state.status,
    document: state.document,
    pageCount: state.pageCount,
    loadedPages: state.loadedPages,
    stage: state.stage,
    error: state.error,
    extractor,
  };
}
