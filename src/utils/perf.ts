// Dev-only per-stage timing for the synthesis hot path; a no-op in release builds.
export type StageTimer = {
  mark: (stage: string) => void;
  done: () => void;
  elapsedMs: () => number;
};

const NOOP: StageTimer = { mark: () => {}, done: () => {}, elapsedMs: () => 0 };

export function stageTimer(label: string): StageTimer {
  if (!__DEV__) return NOOP;
  const t0 = Date.now();
  let last = t0;
  return {
    mark(stage: string) {
      const now = Date.now();
      console.log(`[perf:${label}] ${stage} +${now - last}ms`);
      last = now;
    },
    done() {
      console.log(`[perf:${label}] total ${Date.now() - t0}ms`);
    },
    elapsedMs() {
      return Date.now() - t0;
    },
  };
}
