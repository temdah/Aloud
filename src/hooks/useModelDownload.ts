import { useCallback, useState, useSyncExternalStore } from 'react';
import { areModelsDownloaded, deleteModel, ensureModelsDownloaded } from '../supertonic';
import type { ModelDownloadEntry, ModelDownloadState } from './useModelDownloadTypes';

// Controller for one model build's download — wraps ensureModelsDownloaded with
// reactive progress. In-flight state lives in a module-level registry (not local
// state) so it survives leaving and re-entering the model screen: the download
// keeps running and the progress bar reappears on return.

const registry = new Map<string, ModelDownloadEntry>();
const listeners = new Set<() => void>();

const keyOf = (modelId: string, voiceId: string) => `${modelId}|${voiceId}`;
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

function startDownload(modelId: string, voiceId: string) {
  const key = keyOf(modelId, voiceId);
  if (registry.get(key)?.running) return; // already downloading — don't double-start
  registry.set(key, { status: 'downloading', progress: 0, files: [], running: true });
  emit();

  const seen = new Map<string, number>();
  ensureModelsDownloaded(modelId, voiceId, ({ file, bytesWritten, totalBytes, overall }) => {
    seen.set(file, totalBytes > 0 ? bytesWritten / totalBytes : 1);
    registry.set(key, {
      status: 'downloading',
      progress: overall,
      files: Array.from(seen, ([name, fraction]) => ({ name, fraction })),
      running: true,
    });
    emit();
  })
    .then(() => {
      registry.set(key, { status: 'ready', progress: 1, files: [], running: false });
      emit();
    })
    .catch((e) => {
      registry.set(key, {
        status: 'error',
        progress: 0,
        files: [],
        error: e instanceof Error ? e.message : String(e),
        running: false,
      });
      emit();
    });
}

export function useModelDownload(modelId: string, voiceId: string): ModelDownloadState {
  const key = keyOf(modelId, voiceId);
  const entry = useSyncExternalStore(subscribe, () => registry.get(key));

  // Disk-derived fallback when no download has been touched this session. Checked
  // once per mount (an in-flight/finished registry entry always wins over this).
  const [disk] = useState<ModelDownloadEntry>(() =>
    areModelsDownloaded(modelId, voiceId)
      ? { status: 'ready', progress: 1, files: [], running: false }
      : { status: 'idle', progress: 0, files: [], running: false },
  );
  const current = entry ?? disk;

  const start = useCallback(() => startDownload(modelId, voiceId), [modelId, voiceId]);
  const remove = useCallback(() => {
    deleteModel(modelId);
    registry.set(keyOf(modelId, voiceId), { status: 'idle', progress: 0, files: [], running: false });
    emit();
  }, [modelId, voiceId]);

  return {
    status: current.status,
    progress: current.progress,
    files: current.files,
    error: current.error,
    start,
    remove,
  };
}
