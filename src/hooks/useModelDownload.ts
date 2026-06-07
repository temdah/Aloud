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
    const seen = new Map<string, number>();

    ensureModelsDownloaded(modelId, voiceId, ({ file, bytesWritten, totalBytes, overall }) => {
      // `overall` is computed against a fixed denominator in the downloader, so
      // it climbs smoothly to 1 once — no per-file resets.
      setProgress(overall);
      seen.set(file, totalBytes > 0 ? bytesWritten / totalBytes : 1);
      setFiles(Array.from(seen, ([name, fraction]) => ({ name, fraction })));
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
