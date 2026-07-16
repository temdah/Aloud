// Dev-only per-stage timing for the synthesis hot path. Every method is a no-op
// in release builds, so there is zero overhead in production. Use it to profile
// where a chunk's wall time goes (tokenize / duration / denoise / vocoder /
// wav-encode / aac-encode) and to record the realtime factor.
export type StageTimer = {
  /** Log the time since the previous mark, tagged with `stage`. */
  mark: (stage: string) => void;
  /** Log the total elapsed time since the timer was created. */
  done: () => void;
  /** Wall time (ms) since creation — for computing a realtime factor. */
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
