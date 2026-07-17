import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { getEngine, getVoice, prerenderDocument, settingsHash, withEngine } from '../supertonic';
import type { NarrationSettings } from '../supertonic';
import { useDocumentsStore } from '../stores';
import type { Chunk } from '../types';

export type PrerenderContextValue = {
  /** docHash of the render currently in flight, or null when idle. */
  activeDocHash: string | null;
  /** Begin (or resume) rendering every chunk of a document in the background. */
  start: (docHash: string, chunks: Chunk[], settings: NarrationSettings) => void;
  /** Cooperatively cancel the active render (no-op if a different doc is active). */
  cancel: (docHash: string) => void;
};

const PrerenderContext = createContext<PrerenderContextValue | null>(null);

// Drives "make full audiobook" from ABOVE the navigator so a render keeps going
// (and keeps reporting progress) after the user leaves the Prerender screen.
// Progress is written to the persisted documents store, so the Library circular
// progress and "cache is complete" survive app restarts. One render at a time.
export function PrerenderProvider({ children }: { children: ReactNode }) {
  const setAudiobook = useDocumentsStore((s) => s.setAudiobook);
  const [activeDocHash, setActiveDocHash] = useState<string | null>(null);
  const busyRef = useRef(false);
  const cancelRef = useRef(false);

  const start = useCallback(
    (docHash: string, chunks: Chunk[], settings: NarrationSettings) => {
      if (busyRef.current) return; // one render at a time
      if (!settings.modelId || chunks.length === 0) return;
      const total = chunks.length;
      const profileHash = settingsHash(settings);
      busyRef.current = true;
      cancelRef.current = false;
      setActiveDocHash(docHash);
      setAudiobook(docHash, { done: 0, total, status: 'running', profileHash });
      void (async () => {
        try {
          const tts = await getEngine(settings.modelId);
          const voice = await getVoice(settings.modelId, settings.voiceId);
          // Wrap the whole render so a model swap waits for it (shares sessions
          // with live playback — no second resident engine).
          const result = await withEngine(settings.modelId, () =>
            prerenderDocument({
              tts,
              voice,
              docHash,
              chunks,
              settings,
              onProgress: ({ done }) => setAudiobook(docHash, { done, total, status: 'running', profileHash }),
              shouldCancel: () => cancelRef.current,
            }),
          );
          setAudiobook(docHash, {
            done: result.done,
            total,
            status: result.completed ? 'done' : 'cancelled',
            profileHash,
          });
        } catch (e) {
          setAudiobook(docHash, {
            done: 0,
            total,
            status: 'error',
            profileHash,
            error: e instanceof Error ? e.message : String(e),
          });
        } finally {
          busyRef.current = false;
          setActiveDocHash(null);
        }
      })();
    },
    [setAudiobook],
  );

  const cancel = useCallback(
    (docHash: string) => {
      if (activeDocHash === docHash) cancelRef.current = true;
    },
    [activeDocHash],
  );

  const value = useMemo<PrerenderContextValue>(() => ({ activeDocHash, start, cancel }), [activeDocHash, start, cancel]);
  return <PrerenderContext.Provider value={value}>{children}</PrerenderContext.Provider>;
}

export function usePrerenderContext(): PrerenderContextValue {
  const ctx = useContext(PrerenderContext);
  if (!ctx) throw new Error('usePrerenderContext must be used within a PrerenderProvider');
  return ctx;
}
