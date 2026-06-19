import { File } from 'expo-file-system';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { extractDocx, extractMarkdown } from '../extractors';
import { PdfTextExtractor, clearExtractedImages, loadExtractedText, saveExtractedImage, saveExtractedText } from '../pdf';
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

  // Persists a fully-built document: cache it, build the chunk manifest, record
  // the page count. Shared by the md/docx path and the PDF stream's onDone.
  const finalize = useCallback((d: ImportedDocument, extracted: ExtractedDocument) => {
    saveExtractedText(d.docHash, extracted);
    try {
      loadChunks(d.docHash, extracted.text);
    } catch {}
    if (extracted.pageCount > 0) setPageCount(d.docHash, extracted.pageCount);
  }, [setPageCount]);

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
    // Re-extracting → drop any images from a previous extraction of this doc.
    clearExtractedImages(doc.docHash);

    // Markdown/docx are parsed directly in JS (no WebView), so they resolve
    // synchronously here. PDF falls through to the streaming extractor below.
    if (doc.kind === 'markdown' || doc.kind === 'docx') {
      try {
        const file = new File(doc.fileUri);
        const extracted =
          doc.kind === 'markdown' ? extractMarkdown(file.textSync()) : extractDocx(file.bytesSync());
        finalize(doc, extracted);
        setState({ status: 'ready', document: extracted, pageCount: extracted.pageCount, loadedPages: extracted.pageCount, stage: '' });
      } catch (e) {
        setState({ ...IDLE, status: 'error', error: e instanceof Error ? e.message : String(e) });
      }
      return;
    }

    setState({ ...IDLE, status: 'loading' });
  }, [doc?.docHash]);

  const onMeta = useCallback((pageCount: number) => {
    pageCountRef.current = pageCount;
    setState((s) => ({ ...s, status: 'streaming', pageCount, document: { text: '', blocks: [], pageCount } }));
  }, []);

  const onPage = useCallback((page: number, blocks: ExtractedBlock[], textSegment: string) => {
    // Persist any image blocks (sent as base64) to files, keeping only the uri so
    // the cached document stays small. Drop an image if it can't be written.
    const docHash = doc?.docHash;
    const processed = docHash
      ? blocks
          .map((b, i) => {
            if (b.kind !== 'image' || !b.dataUri) return b;
            try {
              const uri = saveExtractedImage(docHash, `${page}-${i}`, b.dataUri);
              return { ...b, uri, dataUri: undefined };
            } catch {
              return null;
            }
          })
          .filter((b): b is ExtractedBlock => b !== null)
      : blocks;
    blocksRef.current = blocksRef.current.concat(processed);
    textRef.current += textSegment;
    setState((s) => ({
      ...s,
      status: 'streaming',
      loadedPages: page,
      document: { text: textRef.current, blocks: blocksRef.current, pageCount: pageCountRef.current },
    }));
  }, [doc?.docHash]);

  const onDone = useCallback(() => {
    if (!doc) return;
    const finalDoc: ExtractedDocument = {
      text: textRef.current.replace(/\s+$/, ''),
      blocks: blocksRef.current,
      pageCount: pageCountRef.current,
    };
    finalize(doc, finalDoc);
    setState({ status: 'ready', document: finalDoc, pageCount: finalDoc.pageCount, loadedPages: finalDoc.pageCount, stage: '' });
  }, [doc?.docHash, finalize]);

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
