// Types for model/asset file management.

/** A single downloadable model/asset file. */
export type ModelAsset = {
  name: string;
  url: string;
  minBytes: number;
};

/** Reports per-file model download progress. */
export type ModelDownloadProgress = (info: {
  file: string;
  index: number;
  total: number;
  bytesWritten: number;
  totalBytes: number;
}) => void;
