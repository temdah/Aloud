export type InferencePriority = 'foreground' | 'background';

export type InferenceTask<T> = {
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

export type InferenceQueueSnapshot = {
  running: boolean;
  foregroundPending: number;
  backgroundPending: number;
};
