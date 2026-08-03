import type { NarrationSynthesisMetrics } from '../supertonic';
import type { Span } from '../utils';
import type { VoiceChunkBenchmark } from './voiceBenchmarkTypes';

export const sleep = (value: number) => new Promise<void>((resolve) => setTimeout(resolve, value));
export const milliseconds = (value: number) => `${Math.round(value)} ms`;
export const benchmarkRow = (label: string, value: string) => `  ${label.padEnd(20)} ${value}`;
export const describeBenchmarkError = (error: unknown) => error instanceof Error ? error.message : String(error);
export const requireBenchmarkValue = <T,>(value: T | null | undefined, message: string): T => {
  if (value == null) throw new Error(message);
  return value;
};
export const firstAudioMilliseconds = (result: VoiceChunkBenchmark) => result.synthMs + result.encodeMs + result.writeMs;
export const standardRtf = (wallMs: number, audioSec: number) => wallMs / 1000 / Math.max(0.001, audioSec);
export const synthesisThroughput = (wallMs: number, audioSec: number) => audioSec / Math.max(0.001, wallMs / 1000);
export const benchmarkPercent = (part: number, total: number) => `${((part / Math.max(1, total)) * 100).toFixed(1)}%`;
export const minimum = (values: number[]) => Math.min(...values);
export const maximum = (values: number[]) => Math.max(...values);
export const optionalMilliseconds = (value: number | null) => value == null ? '—' : milliseconds(value);
export const optionalNumber = (value: number | null, suffix: string) => value == null ? 'unknown' : `${value.toFixed(1)}${suffix}`;

const THERMAL_STATUS = ['none', 'light', 'moderate', 'severe', 'critical', 'emergency', 'shutdown'] as const;

export function thermalStatusLabel(status: number | null): string {
  if (status == null) return 'unavailable (Android < 10)';
  return THERMAL_STATUS[status] ?? `unknown (${status})`;
}

export function summarizeDurations(values: number[]): string {
  if (values.length === 0) return '(none)';
  return `${values.length} · p50 ${milliseconds(percentile(values, 0.5))} · p95 ${milliseconds(percentile(values, 0.95))}`;
}

export function percentile(values: number[], fraction: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1));
  return sorted[index];
}

export function benchmarkStageRow(label: string, durationMs: number, totalMs: number, detail?: string): string {
  const suffix = detail ? ` · ${detail}` : '';
  return benchmarkRow(label, `${milliseconds(durationMs)} · ${benchmarkPercent(durationMs, totalMs)}${suffix}`);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatProductionMetrics(metrics: NarrationSynthesisMetrics): string {
  return [
    benchmarkStageRow('ONNX synth', metrics.synthMs, metrics.totalMs),
    benchmarkStageRow('PCM conversion (native)', metrics.pcmMs, metrics.totalMs),
    benchmarkStageRow('AAC encoding', metrics.aacMs, metrics.totalMs),
    benchmarkRow('audio length', `${metrics.audioSec.toFixed(2)} s (predicted ${metrics.predictedSec.toFixed(2)} s)`),
    benchmarkRow('tokens / samples', `${metrics.tokenCount} / ${metrics.waveformSamples.toLocaleString()}`),
    benchmarkRow('latent dim × len', `${metrics.latentDim} × ${metrics.latentLen}`),
    benchmarkRow('AAC output', formatBytes(metrics.outputBytes)),
    benchmarkRow('tone', `${metrics.requestedTone} → ${metrics.resolvedTone} · synth speed ×${metrics.synthesisSpeed.toFixed(2)}`),
    benchmarkRow('cadence', `${metrics.prosodyBoundary} · ${metrics.trailingPauseMs} ms trailing pause`),
    benchmarkRow('standard RTF', standardRtf(metrics.totalMs, metrics.audioSec).toFixed(3)),
    benchmarkRow('throughput', `${synthesisThroughput(metrics.totalMs, metrics.audioSec).toFixed(2)}× realtime`),
  ].join('\n');
}

export function formatBenchmarkTrace(spans: Span[]): string {
  if (spans.length === 0) return '  (no trace captured)';
  return spans
    .slice()
    .sort((a, b) => a.startMs - b.startMs)
    .map((span) => {
      const duration = span.endMs - span.startMs;
      const start = `${Math.round(span.startMs)}`.padStart(6);
      return `  @${start}ms  ${duration > 0 ? `+${Math.round(duration)}ms`.padEnd(8) : 'mark    '}${span.label}`;
    })
    .join('\n');
}
