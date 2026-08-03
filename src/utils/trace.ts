// Runtime span tracer for the dev diagnostics. Off by default (a boolean check,
// near-zero cost), enabled while a diagnostic scenario runs so the real code path
// — in release builds, where the perf issues actually live — is what's measured.
// Spans are independent (start/end recorded per call), so overlapping/parallel
// work traces correctly.

let active = false;
let t0 = 0;
let spans: Span[] = [];

const NOOP = () => {};

export function isTracing(): boolean {
  return active;
}

export function traceStart(): void {
  active = true;
  t0 = Date.now();
  spans = [];
}

export function traceStop(): Span[] {
  active = false;
  return spans;
}

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

export async function traceSpan<T>(label: string, fn: () => Promise<T>): Promise<T> {
  if (!active) return fn();
  const startMs = Date.now() - t0;
  try {
    return await fn();
  } finally {
    spans.push({ label, startMs, endMs: Date.now() - t0 });
  }
}
import type { Span } from './traceTypes';
