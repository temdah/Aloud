import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { fileStorage } from './fileStorage';
import type { DocumentsState } from './documentsStoreTypes';

// Persisted per-document state: library entries, reading cursor + progress,
// favourites, and full-audiobook render status.

export const useDocumentsStore = create<DocumentsState>()(
  persist(
    (set) => ({
      documents: [],
      hintsSeen: [],
      favourites: [],
      cursor: {},
      progress: {},
      renderProfile: {},
      audiobook: {},
      addDocument: (doc) =>
        set((state) => ({
          documents: [doc, ...state.documents.filter((d) => d.docHash !== doc.docHash)],
        })),
      setPageCount: (docHash, pageCount) =>
        set((state) => ({
          documents: state.documents.map((d) => (d.docHash === docHash ? { ...d, pageCount } : d)),
        })),
      setDocLang: (docHash, lang) =>
        set((state) => ({
          documents: state.documents.map((d) =>
            d.docHash === docHash ? { ...d, lang: lang ?? undefined } : d,
          ),
        })),
      setCover: (docHash, cover) =>
        set((state) => ({
          documents: state.documents.map((d) =>
            d.docHash === docHash ? { ...d, cover: cover ?? undefined } : d,
          ),
        })),
      markHintSeen: (docHash) =>
        set((state) => (state.hintsSeen.includes(docHash) ? state : { hintsSeen: [...state.hintsSeen, docHash] })),
      toggleFavourite: (docHash) =>
        set((state) => ({
          favourites: state.favourites.includes(docHash)
            ? state.favourites.filter((h) => h !== docHash)
            : [...state.favourites, docHash],
        })),
      setCursor: (docHash, charOffset) =>
        set((state) => ({ cursor: { ...state.cursor, [docHash]: charOffset } })),
      setProgress: (docHash, fraction) =>
        set((state) => ({ progress: { ...state.progress, [docHash]: Math.max(0, Math.min(1, fraction)) } })),
      setRenderProfile: (docHash, profile) =>
        set((state) => {
          if (profile) return { renderProfile: { ...state.renderProfile, [docHash]: profile } };
          const { [docHash]: _removed, ...renderProfile } = state.renderProfile;
          return { renderProfile };
        }),
      setAudiobook: (docHash, audiobookState) =>
        set((state) => ({ audiobook: { ...state.audiobook, [docHash]: audiobookState } })),
      clearAudiobook: (docHash) =>
        set((state) => {
          const { [docHash]: _removed, ...audiobook } = state.audiobook;
          return { audiobook };
        }),
      removeDocument: (docHash) =>
        set((state) => {
          const { [docHash]: _cursor, ...cursor } = state.cursor;
          const { [docHash]: _progress, ...progress } = state.progress;
          const { [docHash]: _profile, ...renderProfile } = state.renderProfile;
          const { [docHash]: _audiobook, ...audiobook } = state.audiobook;
          return {
            documents: state.documents.filter((d) => d.docHash !== docHash),
            cursor,
            progress,
            renderProfile,
            audiobook,
            hintsSeen: state.hintsSeen.filter((h) => h !== docHash),
            favourites: state.favourites.filter((h) => h !== docHash),
          };
        }),
    }),
    { name: 'documents', storage: createJSONStorage(() => fileStorage) },
  ),
);
