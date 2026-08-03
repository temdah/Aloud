export type ModelDownloadStatus = 'idle' | 'downloading' | 'ready' | 'error';

export type ModelDownloadState = {
  status: ModelDownloadStatus;
  progress: number;
  files: { name: string; fraction: number }[];
  error?: string;
  start: () => void;
  remove: () => void;
};

export type ModelDownloadEntry = {
  status: ModelDownloadStatus;
  progress: number;
  files: { name: string; fraction: number }[];
  error?: string;
  running: boolean;
};
