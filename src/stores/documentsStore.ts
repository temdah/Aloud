import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ImportedDocument } from '../types';
import { fileStorage } from './fileStorage';

type DocumentsState = {
  documents: ImportedDocument[];
  /** Add an imported PDF, or replace an existing one with the same docHash. */
  addDocument: (doc: ImportedDocument) => void;
};

export const useDocumentsStore = create<DocumentsState>()(
  persist(
    (set) => ({
      documents: [],
      addDocument: (doc) =>
        set((state) => ({
          documents: [doc, ...state.documents.filter((d) => d.docHash !== doc.docHash)],
        })),
    }),
    { name: 'documents', storage: createJSONStorage(() => fileStorage) },
  ),
);
