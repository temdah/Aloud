import { useCallback } from 'react';
import { usePrerenderContext } from '../prerender';
import { useDocumentsStore } from '../stores';
import type { NarrationSettings } from '../supertonic';
import type { Chunk } from '../types';
import type { PrerenderState, PrerenderStatus } from './usePrerenderTypes';

// Per-document view over the global PrerenderProvider (the render loop lives there
// so it survives leaving the screen) plus the persisted store.

export function usePrerender(docHash: string, documentText: string, chunks: Chunk[]): PrerenderState {
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

  const start = useCallback(
    (settings: NarrationSettings) => ctxStart(docHash, documentText, chunks, settings),
    [ctxStart, docHash, documentText, chunks],
  );
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
