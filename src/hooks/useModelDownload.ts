import { useCallback, useState } from 'react';
import { areModelsDownloaded, deleteModel, ensureModelsDownloaded } from '../supertonic';

export type ModelDownloadStatus = 'idle' | 'downloading' | 'ready' | 'error';

export type ModelDownloadState = {
  status: ModelDownloadStatus;
  /** Overall progress 0..1 (byte-weighted across files seen so far). */
  progress: number;
  files: { name: string; fraction: number }[];
  error?: string;
  /** Begin (or retry) the download. */
  start: () => void;
  /** Delete this build's files to free storage; resets back to 'idle'. */
  remove: () => void;
};

// Controller for one model build's download — wraps ensureModelsDownloaded with
// reactive progress. Drives a model card / the voice-model screen. Starts in
// 'ready' if that build is already present on device.
export function useModelDownload(modelId: string, voiceId: string): ModelDownloadState {
  const [status, setStatus] = useState<ModelDownloadStatus>(() =>
    areModelsDownloaded(modelId, voiceId) ? 'ready' : 'idle',
  );
  const [progress, setProgress] = useState(() => (areModelsDownloaded(modelId, voiceId) ? 1 : 0));
  const [files, setFiles] = useState<{ name: string; fraction: number }[]>([]);
  const [error, setError] = useState<string | undefined>();

  const start = useCallback(() => {
    setStatus('downloading');
    setError(undefined);
    const seen = new Map<string, { written: number; total: number }>();

    ensureModelsDownloaded(modelId, voiceId, ({ file, bytesWritten, totalBytes }) => {
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
  }, [modelId, voiceId]);

  const remove = useCallback(() => {
    deleteModel(modelId);
    setStatus('idle');
    setProgress(0);
    setFiles([]);
    setError(undefined);
  }, [modelId]);

  return { status, progress, files, error, start, remove };
}
