import type { NarrationSettings } from '../supertonic';
import type { ImportedDocument } from '../types';

export type AudiobookState = {
  done: number;
  total: number;
  status: 'running' | 'done' | 'cancelled' | 'error';
  profileHash: string;
  error?: string;
};

export type DocumentsState = {
  documents: ImportedDocument[];
  hintsSeen: string[];
  favourites: string[];
  cursor: Record<string, number>;
  progress: Record<string, number>;
  renderProfile: Record<string, NarrationSettings>;
  audiobook: Record<string, AudiobookState>;
  addDocument: (document: ImportedDocument) => void;
  setPageCount: (docHash: string, pageCount: number) => void;
  setDocLang: (docHash: string, lang: string | null) => void;
  setCover: (docHash: string, cover: number | null) => void;
  markHintSeen: (docHash: string) => void;
  toggleFavourite: (docHash: string) => void;
  setCursor: (docHash: string, charOffset: number) => void;
  setProgress: (docHash: string, fraction: number) => void;
  setRenderProfile: (docHash: string, profile: NarrationSettings | null) => void;
  setAudiobook: (docHash: string, state: AudiobookState) => void;
  clearAudiobook: (docHash: string) => void;
  removeDocument: (docHash: string) => void;
};
