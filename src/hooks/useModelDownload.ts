import { useCallback, useState } from 'react';
import { areModelsDownloaded, DEFAULT_VOICE, ensureModelsDownloaded } from '../supertonic';

export type ModelDownloadStatus = 'idle' | 'downloading' | 'ready' | 'error';

export type ModelDownloadState = {
  status: ModelDownloadStatus;
  /** Overall progress 0..1 (byte-weighted across files seen so far). */
  progress: number;
  files: { name: string; fraction: number }[];
  error?: string;
  /** Begin (or retry) the download. */
  start: () => void;
};

// Controller for the first-run model download — wraps ensureModelsDownloaded
// with reactive progress. Drives DownloadScreen. Starts in 'ready' if the
// model is already present.
export function useModelDownload(voiceId: string = DEFAULT_VOICE): ModelDownloadState {
  const [status, setStatus] = useState<ModelDownloadStatus>(() =>
    areModelsDownloaded(voiceId) ? 'ready' : 'idle',
  );
  const [progress, setProgress] = useState(() => (areModelsDownloaded(voiceId) ? 1 : 0));
  const [files, setFiles] = useState<{ name: string; fraction: number }[]>([]);
  const [error, setError] = useState<string | undefined>();

  const start = useCallback(() => {
    setStatus('downloading');
    setError(undefined);
    const seen = new Map<string, { written: number; total: number }>();

    ensureModelsDownloaded(voiceId, ({ file, bytesWritten, totalBytes }) => {
      seen.set(file, { written: bytesWritten, total: totalBytes > 0 ? totalBytes : bytesWritten });
      const all = Array.from(seen.values());
      const written = all.reduce((sum, x) => sum + x.written, 0);
      const total = all.reduce((sum, x) => sum + x.total, 0);
      setProgress(total > 0 ? written / total : 0);
      setFiles(Array.from(seen, ([name, v]) => ({ name, fraction: v.total > 0 ? v.written / v.total : 0 })));
    })
      .then(() => {
        setProgress(1);
        setStatus('ready');
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : String(e));
        setStatus('error');
      });
  }, [voiceId]);

  return { status, progress, files, error, start };
}
