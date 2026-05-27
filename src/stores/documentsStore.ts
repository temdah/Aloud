import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ImportedDocument } from '../types';
import { fileStorage } from './fileStorage';

type DocumentsState = {
  documents: ImportedDocument[];
  /** docHashes whose first-open reader hint has already been shown. */
  hintsSeen: string[];
  /** docHash → last chunk index reached, so playback can resume where it left off. */
  cursor: Record<string, number>;
  /** Add an imported PDF, or replace an existing one with the same docHash. */
  addDocument: (doc: ImportedDocument) => void;
  /** Record a document's page count once its text layer has been parsed. */
  setPageCount: (docHash: string, pageCount: number) => void;
  /** Mark a document's first-open hint as shown (so it never shows again). */
  markHintSeen: (docHash: string) => void;
  /** Persist the last chunk index reached for a document. */
  setCursor: (docHash: string, chunkIdx: number) => void;
  /** Remove a document and all of its associated bookkeeping (cursor, hint). */
  removeDocument: (docHash: string) => void;
};

export const useDocumentsStore = create<DocumentsState>()(
  persist(
    (set) => ({
      documents: [],
      hintsSeen: [],
      cursor: {},
      addDocument: (doc) =>
        set((state) => ({
          documents: [doc, ...state.documents.filter((d) => d.docHash !== doc.docHash)],
        })),
      setPageCount: (docHash, pageCount) =>
        set((state) => ({
          documents: state.documents.map((d) => (d.docHash === docHash ? { ...d, pageCount } : d)),
        })),
      markHintSeen: (docHash) =>
        set((state) => (state.hintsSeen.includes(docHash) ? state : { hintsSeen: [...state.hintsSeen, docHash] })),
      setCursor: (docHash, chunkIdx) =>
        set((state) => ({ cursor: { ...state.cursor, [docHash]: chunkIdx } })),
      removeDocument: (docHash) =>
        set((state) => {
          const { [docHash]: _removed, ...cursor } = state.cursor;
          return {
            documents: state.documents.filter((d) => d.docHash !== docHash),
            cursor,
            hintsSeen: state.hintsSeen.filter((h) => h !== docHash),
          };
        }),
    }),
    { name: 'documents', storage: createJSONStorage(() => fileStorage) },
  ),
);
