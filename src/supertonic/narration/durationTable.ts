// Whole-document timeline support. We get every chunk's spoken length from the
// duration predictor (stage 1, ~9 ms/chunk, NO synthesis), sum them, and do
// arithmetic to convert between "time on the scrubber" and "which chunk + how
// far in". This powers the in-app full timeline (and later the notification's
// virtual timeline) without rendering any audio up front.
//
// Durations are stored at the engine's NEUTRAL rate (speed 1.0). Playback speed
// is a pure divisor applied live, so the table never needs rebuilding when speed
// changes — only when the model / voice / language (which change the predicted
// length) or the chunk list change.
import { File } from 'expo-file-system';
import type { Chunk } from '../../types';
import { stableHash } from '../../utils';
import type { TextToSpeech } from '../synthesis/textToSpeech';
import type { VoiceStyle } from '../synthesis/voiceStyle';
import { documentCacheDir } from './audioCache';
import type { NarrationSettings } from './narrationTypes';

// Bump if the predictor's output or this file's shape changes.
const TABLE_VERSION = 1;

/** Per-chunk neutral-rate seconds, in canonical chunk order. */
export type DurationTable = number[];

type StoredTable = { hash: string; seconds: number[] };

// Duration depends only on model + voice + language (+ the text itself), NOT on
// steps or speed — so it's keyed separately from the audio-cache settingsHash.
function tableHash(s: NarrationSettings): string {
  return stableHash(`dt${TABLE_VERSION}|${s.modelId}|${s.voiceId}|${s.lang}`);
}

function tableFile(docHash: string): File {
  return new File(documentCacheDir(docHash), 'durations.json');
}

/** Read a cached table iff it matches the current profile AND chunk count. */
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
    // Non-fatal: the timeline just falls back to recomputing next time.
  }
}

export type BuildDurationTableOptions = {
  onProgress?: (done: number, total: number) => void;
  /** Polled before each chunk; return true to abandon (e.g. settings changed). */
  shouldCancel?: () => boolean;
};

// Builds (or returns the cached) neutral-seconds table for a document. Cheap:
// one duration-predictor pass per chunk. Persists the result so reopening the
// document is instant. Returns null if cancelled before completing.
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
  // Batch the predictor: one run per BATCH chunks instead of one per chunk. The
  // model is tiny, so a fixed batch with padding waste beats per-chunk JSI
  // round-trips. Cancellation is honored between batches.
  const BATCH = 16;
  const seconds: number[] = [];
  for (let i = 0; i < chunks.length; i += BATCH) {
    if (opts.shouldCancel?.()) return null;
    const slice = chunks.slice(i, i + BATCH);
    const durs = await tts.predictDurationsSec(
      slice.map((c) => c.text),
      s.lang,
      voice,
    );
    for (const d of durs) seconds.push(d);
    opts.onProgress?.(Math.min(i + BATCH, chunks.length), chunks.length);
  }
  writeDurationTable(docHash, seconds, s);
  return seconds;
}

// ---- Pure time<->chunk math (speed applied here, table stays neutral) --------

/** Document time (seconds, at `speed`) at which each chunk starts. */
export function cumulativeOffsetsSec(table: DurationTable, speed: number): number[] {
  const offsets = new Array<number>(table.length);
  let acc = 0;
  for (let i = 0; i < table.length; i++) {
    offsets[i] = acc;
    acc += table[i] / speed;
  }
  return offsets;
}

/** Total document runtime in seconds at `speed`. */
export function totalDurationSec(table: DurationTable, speed: number): number {
  let acc = 0;
  for (const d of table) acc += d;
  return acc / speed;
}

export type TimeLocation = {
  /** Canonical chunk index the time falls in. */
  index: number;
  /** Seconds into that chunk's clip, at the NEUTRAL rate (for player.seekTo). */
  withinNeutralSec: number;
};

// Maps an absolute document time (seconds, at `speed`) to a chunk + an offset
// within that chunk's clip. Binary search over cumulative offsets so it's cheap
// even for very long documents.
export function locateTime(table: DurationTable, speed: number, t: number): TimeLocation | null {
  if (table.length === 0) return null;
  const offsets = cumulativeOffsetsSec(table, speed);
  const clamped = Math.max(0, t);
  // Find the last chunk whose start offset is <= clamped.
  let lo = 0;
  let hi = offsets.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (offsets[mid] <= clamped) lo = mid;
    else hi = mid - 1;
  }
  const withinDocSec = clamped - offsets[lo];
  // Convert document-time offset back to neutral clip time, clamped to the clip.
  const withinNeutralSec = Math.max(0, Math.min(table[lo], withinDocSec * speed));
  return { index: lo, withinNeutralSec };
}
