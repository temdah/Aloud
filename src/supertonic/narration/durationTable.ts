// Neutral-rate chunk durations back the document scrubber and survive speed changes.
import { File } from 'expo-file-system';
import type { Chunk } from '../../types';
import { stableHash } from '../../utils';
import type { TextToSpeech } from '../synthesis/textToSpeech';
import type { VoiceStyle } from '../synthesis/voiceStyle';
import { documentCacheDir, readChunkTiming } from './audioCache';
import type { BuildDurationTableOptions, DurationTable, StoredDurationTable, TimeLocation } from './durationTableTypes';
import type { NarrationSettings } from './narrationTypes';

const TABLE_VERSION = 1;

// Steps and playback speed do not affect predicted neutral-rate duration.
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
    const stored = JSON.parse(file.textSync()) as StoredDurationTable;
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
    file.write(JSON.stringify({ hash: tableHash(s), seconds } satisfies StoredDurationTable));
  } catch {
  }
}

// Rebuild from timing sidecars without loading the engine; null means prediction is required.
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

const CHARS_PER_SEC = 14;

export function buildTimeline(docHash: string, chunks: Chunk[], s: NarrationSettings): DurationTable {
  const stored = loadDurationTable(docHash, chunks.length, s);
  if (stored) return stored;

  const seconds = new Array<number>(chunks.length);
  let complete = true;
  for (let i = 0; i < chunks.length; i++) {
    const measured = readChunkTiming(docHash, chunks[i].charStart, s);
    if (measured == null) complete = false;
    seconds[i] = measured ?? Math.max(0.3, chunks[i].text.length / CHARS_PER_SEC);
  }
  if (complete && chunks.length > 0) writeDurationTable(docHash, seconds, s);
  return seconds;
}

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

  const seconds = new Array<number>(chunks.length);
  const missing: number[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const t = readChunkTiming(docHash, chunks[i].charStart, s);
    if (t != null) seconds[i] = t;
    else missing.push(i);
  }
  let done = chunks.length - missing.length;
  opts.onProgress?.(done, chunks.length);

  // Batching trades minor padding for fewer JSI round-trips and yields between batches.
  const BATCH = 16;
  for (let i = 0; i < missing.length; i += BATCH) {
    if (opts.shouldCancel?.()) return null;
    await opts.beforeBatch?.();
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

// Binary search maps at-speed document time to a neutral-rate clip offset.
export function locateTime(
  table: DurationTable,
  speed: number,
  t: number,
  precomputedOffsets?: readonly number[],
): TimeLocation | null {
  if (table.length === 0) return null;
  const offsets =
    precomputedOffsets?.length === table.length ? precomputedOffsets : cumulativeOffsetsSec(table, speed);
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
