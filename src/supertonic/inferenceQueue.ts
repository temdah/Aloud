export type InferencePriority = 'foreground' | 'background';

type Task<T> = {
  run: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
};

export type InferenceQueueSnapshot = {
  running: boolean;
  foregroundPending: number;
  backgroundPending: number;
};

// One inference at a time protects the shared ONNX sessions from contention.
// Foreground playback jumps ahead of queued background work, while each class
// remains FIFO. An already-running inference is allowed to finish safely.
export class InferenceQueue {
  private foreground: Task<unknown>[] = [];
  private background: Task<unknown>[] = [];
  private running = false;

  enqueue<T>(run: () => Promise<T>, priority: InferencePriority): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const task: Task<T> = { run, resolve, reject };
      const queue = priority === 'foreground' ? this.foreground : this.background;
      queue.push(task as Task<unknown>);
      void this.drain();
    });
  }

  snapshot(): InferenceQueueSnapshot {
    return {
      running: this.running,
      foregroundPending: this.foreground.length,
      backgroundPending: this.background.length,
    };
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (this.foreground.length > 0 || this.background.length > 0) {
        const task = this.foreground.shift() ?? this.background.shift();
        if (!task) continue;
        try {
          task.resolve(await task.run());
        } catch (error) {
          task.reject(error);
        }
      }
    } finally {
      this.running = false;
      if (this.foreground.length > 0 || this.background.length > 0) void this.drain();
    }
  }
}
