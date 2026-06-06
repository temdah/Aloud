import { useCallback, useRef, useState } from 'react';
import { loadTextToSpeech, loadVoiceStyle, prerenderDocument } from '../supertonic';
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

// Drives "process entire book": loads the engine + voice once, then walks every
// chunk via prerenderDocument with reactive progress. Already-cached chunks count
// instantly, so a cancelled render resumes cheaply. The cache it fills is the same
// one the live player reads, so afterward playback never waits.
export function usePrerender(docHash: string, chunks: Chunk[]): PrerenderState {
  const [status, setStatus] = useState<PrerenderStatus>('idle');
  const [done, setDone] = useState(0);
  const [error, setError] = useState<string | undefined>();
  const total = chunks.length;
  const cancelRef = useRef(false);

  const start = useCallback(
    (settings: NarrationSettings) => {
      if (!settings.modelId) {
        setError('Pick a voice model first.');
        setStatus('error');
        return;
      }
      cancelRef.current = false;
      setError(undefined);
      setDone(0);
      setStatus('running');
      void (async () => {
        try {
          const tts = await loadTextToSpeech(settings.modelId);
          const voice = await loadVoiceStyle(settings.modelId, settings.voiceId);
          const result = await prerenderDocument({
            tts,
            voice,
            docHash,
            chunks,
            settings,
            onProgress: ({ done: d }) => setDone(d),
            shouldCancel: () => cancelRef.current,
          });
          setStatus(result.completed ? 'done' : 'cancelled');
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
          setStatus('error');
        }
      })();
    },
    [docHash, chunks],
  );

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  return { status, done, total, progress: total > 0 ? done / total : 0, error, start, cancel };
}
