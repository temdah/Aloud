export type StageTimer = {
  mark: (stage: string) => void;
  done: () => void;
  elapsedMs: () => number;
};
