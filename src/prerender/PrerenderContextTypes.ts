import type { NarrationSettings } from '../supertonic';
import type { Chunk } from '../types';

export type PrerenderContextValue = {
  activeDocHash: string | null;
  start: (docHash: string, documentText: string, chunks: Chunk[], settings: NarrationSettings) => void;
  cancel: (docHash: string) => void;
};
