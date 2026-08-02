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
  private foregroundHead = 0;
  private backgroundHead = 0;
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
      foregroundPending: this.foreground.length - this.foregroundHead,
      backgroundPending: this.background.length - this.backgroundHead,
    };
  }

  private async drain(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      while (this.hasPending()) {
        const task = this.dequeue(this.foreground, 'foreground') ?? this.dequeue(this.background, 'background');
        if (!task) continue;
        try {
          task.resolve(await task.run());
        } catch (error) {
          task.reject(error);
        }
      }
    } finally {
      this.running = false;
      if (this.hasPending()) void this.drain();
    }
  }

  private hasPending(): boolean {
    return this.foregroundHead < this.foreground.length || this.backgroundHead < this.background.length;
  }

  private dequeue(queue: Task<unknown>[], priority: InferencePriority): Task<unknown> | undefined {
    const head = priority === 'foreground' ? this.foregroundHead : this.backgroundHead;
    if (head >= queue.length) return undefined;
    const task = queue[head];
    if (priority === 'foreground') this.foregroundHead++;
    else this.backgroundHead++;
    if ((priority === 'foreground' ? this.foregroundHead : this.backgroundHead) === queue.length) {
      queue.length = 0;
      if (priority === 'foreground') this.foregroundHead = 0;
      else this.backgroundHead = 0;
    }
    return task;
  }
}
