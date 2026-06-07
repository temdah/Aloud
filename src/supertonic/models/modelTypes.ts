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
  /**
   * Overall download progress 0..1 across ALL files, weighted by each file's
   * expected size and measured against a fixed denominator (the sum of every
   * asset's expected bytes). Monotonic — reaches 1 exactly once at the end.
   */
  overall: number;
}) => void;
