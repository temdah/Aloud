export type DurationTable = number[];

export type StoredDurationTable = { hash: string; seconds: number[] };

export type BuildDurationTableOptions = {
  onProgress?: (done: number, total: number) => void;
  shouldCancel?: () => boolean;
  beforeBatch?: () => Promise<void>;
};

export type TimeLocation = {
  index: number;
  withinNeutralSec: number;
};
