import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { NarrationSettings } from '../supertonic';
import type { ImportedDocument } from '../types';
import { fileStorage } from './fileStorage';

type DocumentsState = {
  documents: ImportedDocument[];
  /** docHashes whose first-open reader hint has already been shown. */
  hintsSeen: string[];
  /** docHashes the user has starred. */
  favourites: string[];
  /** docHash → last chunk index reached, so playback can resume where it left off. */
  cursor: Record<string, number>;
  /** docHash → the narration settings a full-audiobook render was made with.
   *  The reader uses this profile so tap-to-start hits the pre-rendered cache. */
  renderProfile: Record<string, NarrationSettings>;
  /** Add an imported PDF, or replace an existing one with the same docHash. */
  addDocument: (doc: ImportedDocument) => void;
  /** Record a document's page count once its text layer has been parsed. */
  setPageCount: (docHash: string, pageCount: number) => void;
  /** Mark a document's first-open hint as shown (so it never shows again). */
  markHintSeen: (docHash: string) => void;
  /** Toggle a document's favourite (starred) state. */
  toggleFavourite: (docHash: string) => void;
  /** Persist the last chunk index reached for a document. */
  setCursor: (docHash: string, chunkIdx: number) => void;
  /** Pin (or clear) the narration profile a full audiobook was rendered with. */
  setRenderProfile: (docHash: string, profile: NarrationSettings | null) => void;
  /** Remove a document and all of its associated bookkeeping (cursor, hint). */
  removeDocument: (docHash: string) => void;
};

export const useDocumentsStore = create<DocumentsState>()(
  persist(
    (set) => ({
      documents: [],
      hintsSeen: [],
      favourites: [],
      cursor: {},
      renderProfile: {},
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
      toggleFavourite: (docHash) =>
        set((state) => ({
          favourites: state.favourites.includes(docHash)
            ? state.favourites.filter((h) => h !== docHash)
            : [...state.favourites, docHash],
        })),
      setCursor: (docHash, chunkIdx) =>
        set((state) => ({ cursor: { ...state.cursor, [docHash]: chunkIdx } })),
      setRenderProfile: (docHash, profile) =>
        set((state) => {
          if (profile) return { renderProfile: { ...state.renderProfile, [docHash]: profile } };
          const { [docHash]: _removed, ...renderProfile } = state.renderProfile;
          return { renderProfile };
        }),
      removeDocument: (docHash) =>
        set((state) => {
          const { [docHash]: _cursor, ...cursor } = state.cursor;
          const { [docHash]: _profile, ...renderProfile } = state.renderProfile;
          return {
            documents: state.documents.filter((d) => d.docHash !== docHash),
            cursor,
            renderProfile,
            hintsSeen: state.hintsSeen.filter((h) => h !== docHash),
            favourites: state.favourites.filter((h) => h !== docHash),
          };
        }),
    }),
    { name: 'documents', storage: createJSONStorage(() => fileStorage) },
  ),
);
