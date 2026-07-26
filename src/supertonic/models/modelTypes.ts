// Types for model/asset file management.

export type ModelAsset = {
  name: string;
  url: string;
  minBytes: number;
};

export type ModelDownloadProgress = (info: {
  file: string;
  index: number;
  total: number;
  bytesWritten: number;
  totalBytes: number;
  // 0..1 across all files, weighted by expected size against a fixed denominator;
  // reaches 1 exactly once.
  overall: number;
}) => void;
