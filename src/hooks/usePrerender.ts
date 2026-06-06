import { useCallback } from 'react';
import { usePrerenderContext } from '../prerender';
import { useDocumentsStore } from '../stores';
import type { NarrationSettings } from '../supertonic';
import type { Chunk } from '../types';

export type PrerenderStatus = 'idle' | 'running' | 'done' | 'cancelled' | 'error';

export type PrerenderState = {
  status: PrerenderStatus;
  /** Chunks rendered (or found cached) so far. */
  done: number;
  total: number;
  /** 0..1 across the whole document. */
  progress: number;
  error?: string;
  /** Begin (or resume) rendering every chunk with these settings. */
  start: (settings: NarrationSettings) => void;
  /** Cooperatively stop after the current chunk. */
  cancel: () => void;
};

// Thin view over the global PrerenderProvider + persisted store. The actual
// render loop lives in the provider (so it survives leaving the screen); this
// hook just exposes the current document's status/progress and start/cancel.
export function usePrerender(docHash: string, chunks: Chunk[]): PrerenderState {
  const { activeDocHash, start: ctxStart, cancel: ctxCancel } = usePrerenderContext();
  const audiobook = useDocumentsStore((s) => s.audiobook[docHash]);
  const total = chunks.length || audiobook?.total || 0;
  const running = activeDocHash === docHash;

  const status: PrerenderStatus = running
    ? 'running'
    : audiobook?.status === 'done'
      ? 'done'
      : audiobook?.status === 'cancelled'
        ? 'cancelled'
        : audiobook?.status === 'error'
          ? 'error'
          : 'idle';

  const done = audiobook?.done ?? 0;

  const start = useCallback((settings: NarrationSettings) => ctxStart(docHash, chunks, settings), [ctxStart, docHash, chunks]);
  const cancel = useCallback(() => ctxCancel(docHash), [ctxCancel, docHash]);

  return {
    status,
    done,
    total,
    progress: total > 0 ? done / total : 0,
    error: status === 'error' ? audiobook?.error : undefined,
    start,
    cancel,
  };
}
