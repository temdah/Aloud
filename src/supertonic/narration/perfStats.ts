// Rolling realtime-factor of synthesis (audio seconds produced per wall second),
// per model, in memory for the session. RTF < 1 means synthesis is slower than
// realtime, so playback can't stay ahead and will stall. Drives the reader's
// "device is slow for this voice" tip. Not persisted — recent RTF is what matters.

const EMA_ALPHA = 0.3;
const rtfByModel = new Map<string, number>();

export function recordSynthRtf(modelId: string, rtf: number): void {
  if (!modelId || !Number.isFinite(rtf) || rtf <= 0) return;
  const prev = rtfByModel.get(modelId);
  rtfByModel.set(modelId, prev == null ? rtf : prev * (1 - EMA_ALPHA) + rtf * EMA_ALPHA);
}

export function getSynthRtf(modelId: string | null): number | null {
  if (!modelId) return null;
  return rtfByModel.get(modelId) ?? null;
}
