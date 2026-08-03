export function silenceSampleCount(sampleRate: number, pauseMs: number): number {
  return Math.max(0, Math.round(sampleRate * (pauseMs / 1000)));
}
