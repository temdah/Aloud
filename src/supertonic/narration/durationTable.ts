// Whole-document timeline: each chunk's spoken length from the duration predictor
// (stage 1, ~9 ms/chunk, no synthesis), summed, with math to convert between
// scrubber time and chunk + offset. Durations are stored at the NEUTRAL rate;
// speed is a live divisor, so the table only rebuilds on model/voice/lang change.
import { File } from 'expo-file-system';
import type { Chunk } from '../../types';
import { stableHash } from '../../utils';
import type { TextToSpeech } from '../synthesis/textToSpeech';
import type { VoiceStyle } from '../synthesis/voiceStyle';
import { documentCacheDir, readChunkTiming } from './audioCache';
import type { NarrationSettings } from './narrationTypes';

const TABLE_VERSION = 1;

export type DurationTable = number[];

type StoredTable = { hash: string; seconds: number[] };

// Keyed on model/voice/lang only (not steps/speed), separate from settingsHash.
function tableHash(s: NarrationSettings): string {
  return stableHash(`dt${TABLE_VERSION}|${s.modelId}|${s.voiceId}|${s.lang}`);
}

function tableFile(docHash: string): File {
  return new File(documentCacheDir(docHash), 'durations.json');
}

export function loadDurationTable(docHash: string, chunkCount: number, s: NarrationSettings): DurationTable | null {
  const file = tableFile(docHash);
  if (!file.exists) return null;
  try {
    const stored = JSON.parse(file.textSync()) as StoredTable;
    if (stored.hash !== tableHash(s)) return null;
    if (!Array.isArray(stored.seconds) || stored.seconds.length !== chunkCount) return null;
    return stored.seconds;
  } catch {
    return null;
  }
}

function writeDurationTable(docHash: string, seconds: number[], s: NarrationSettings): void {
  const file = tableFile(docHash);
  try {
    if (file.exists) file.delete();
    file.create();
    file.write(JSON.stringify({ hash: tableHash(s), seconds } satisfies StoredTable));
  } catch {
    // Non-fatal: the timeline just recomputes next time.
  }
}

// Build the whole timeline from disk alone — the stored table, or a complete set
// of per-chunk timing sidecars (written at synth time). Returns null if anything
// is missing, so the caller knows it must load the engine and predict. This is
// what makes reopening an already-played document instant: no engine, no predict.
export function loadDurationTableFromCache(
  docHash: string,
  chunks: Chunk[],
  s: NarrationSettings,
): DurationTable | null {
  const stored = loadDurationTable(docHash, chunks.length, s);
  if (stored) return stored;
  const seconds = new Array<number>(chunks.length);
  for (let i = 0; i < chunks.length; i++) {
    const t = readChunkTiming(docHash, chunks[i].charStart, s);
    if (t == null) return null;
    seconds[i] = t;
  }
  writeDurationTable(docHash, seconds, s); // promote to the single-file fast path
  return seconds;
}

export type BuildDurationTableOptions = {
  onProgress?: (done: number, total: number) => void;
  shouldCancel?: () => boolean;
};

export async function ensureDurationTable(
  tts: TextToSpeech,
  voice: VoiceStyle,
  docHash: string,
  chunks: Chunk[],
  s: NarrationSettings,
  opts: BuildDurationTableOptions = {},
): Promise<DurationTable | null> {
  const cached = loadDurationTable(docHash, chunks.length, s);
  if (cached) {
    opts.onProgress?.(chunks.length, chunks.length);
    return cached;
  }

  // Reuse per-chunk timings from already-cached clips; only predict the gaps.
  const seconds = new Array<number>(chunks.length);
  const missing: number[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const t = readChunkTiming(docHash, chunks[i].charStart, s);
    if (t != null) seconds[i] = t;
    else missing.push(i);
  }
  let done = chunks.length - missing.length;
  opts.onProgress?.(done, chunks.length);

  // Batch the predictor (one run per BATCH chunks) — the model is tiny, so padding
  // waste beats per-chunk JSI round-trips. Cancels between batches.
  const BATCH = 16;
  for (let i = 0; i < missing.length; i += BATCH) {
    if (opts.shouldCancel?.()) return null;
    const idxs = missing.slice(i, i + BATCH);
    const durs = await tts.predictDurationsSec(
      idxs.map((j) => chunks[j].text),
      s.lang,
      voice,
    );
    for (let k = 0; k < idxs.length; k++) seconds[idxs[k]] = durs[k];
    done += idxs.length;
    opts.onProgress?.(done, chunks.length);
  }
  writeDurationTable(docHash, seconds, s);
  return seconds;
}

// ---- time <-> chunk math (speed applied here; table stays neutral) ----

export function cumulativeOffsetsSec(table: DurationTable, speed: number): number[] {
  const offsets = new Array<number>(table.length);
  let acc = 0;
  for (let i = 0; i < table.length; i++) {
    offsets[i] = acc;
    acc += table[i] / speed;
  }
  return offsets;
}

export function totalDurationSec(table: DurationTable, speed: number): number {
  let acc = 0;
  for (const d of table) acc += d;
  return acc / speed;
}

export type TimeLocation = {
  index: number;
  withinNeutralSec: number; // neutral-rate seconds into the clip, for player.seekTo
};

// Maps an absolute at-speed time to a chunk + neutral offset within its clip
// (binary search over cumulative offsets).
export function locateTime(table: DurationTable, speed: number, t: number): TimeLocation | null {
  if (table.length === 0) return null;
  const offsets = cumulativeOffsetsSec(table, speed);
  const clamped = Math.max(0, t);
  let lo = 0;
  let hi = offsets.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offsets[mid] <= clamped) lo = mid;
    else hi = mid - 1;
  }
  const withinDocSec = clamped - offsets[lo];
  const withinNeutralSec = Math.max(0, Math.min(table[lo], withinDocSec * speed));
  return { index: lo, withinNeutralSec };
}
