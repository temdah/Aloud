import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { getEngine, getVoice, prerenderDocument, settingsHash, withEngine } from '../supertonic';
import type { NarrationSettings } from '../supertonic';
import { useDocumentsStore } from '../stores';
import type { Chunk } from '../types';

export type PrerenderContextValue = {
  activeDocHash: string | null;
  start: (docHash: string, chunks: Chunk[], settings: NarrationSettings) => void;
  cancel: (docHash: string) => void;
};

const PrerenderContext = createContext<PrerenderContextValue | null>(null);

// Drives "make full audiobook" from above the navigator so a render keeps going
// (and reporting progress to the store) after the user leaves the screen. One at a time.
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
          // Wrap so a model swap waits for it (shares sessions with live playback).
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
