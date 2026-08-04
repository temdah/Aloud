export type OffsetRange = {
  charStart: number;
  charEnd: number;
};

export type IndexedOffsetRange<T extends OffsetRange = OffsetRange> = {
  block: T;
  globalIndex: number;
};
