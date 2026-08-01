// Runtime span tracer for the dev diagnostics. Off by default (a boolean check,
// near-zero cost), enabled while a diagnostic scenario runs so the real code path
// — in release builds, where the perf issues actually live — is what's measured.
// Spans are independent (start/end recorded per call), so overlapping/parallel
// work traces correctly.

export type Span = { label: string; startMs: number; endMs: number };

let active = false;
let t0 = 0;
let spans: Span[] = [];

const NOOP = () => {};

export function isTracing(): boolean {
  return active;
}

// Begin a fresh trace, clearing any previous spans.
export function traceStart(): void {
  active = true;
  t0 = Date.now();
  spans = [];
}

// Stop tracing and return the recorded spans (relative ms from traceStart).
export function traceStop(): Span[] {
  active = false;
  return spans;
}

// A point-in-time event (zero duration).
export function traceMark(label: string): void {
  if (!active) return;
  const now = Date.now() - t0;
  spans.push({ label, startMs: now, endMs: now });
}

// Open a span manually; returns a function to close it. Safe to call when not
// tracing (returns a no-op). Handles overlapping spans (no shared stack).
export function traceOpen(label: string): () => void {
  if (!active) return NOOP;
  const startMs = Date.now() - t0;
  return () => {
    if (active) spans.push({ label, startMs, endMs: Date.now() - t0 });
  };
}

// Wrap an async operation in a span.
export async function traceSpan<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!active) return fn();
  const startMs = Date.now() - t0;
  try {
    return await fn();
  } finally {
    spans.push({ label, startMs, endMs: Date.now() - t0 });
  }
}
