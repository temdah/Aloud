import { Asset } from 'expo-asset';
import { createAudioPlayer, setAudioModeAsync, useAudioPlayerStatus, type AudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audiobookAudioUri, chunkAudioUri, cumulativeOffsetsSec, ensureChunkAudio, ensureDurationTable, ensureLeadAudio, getEngine, getVoice, isAudiobookCached, getSynthRtf, isChunkCached, isLeadCached, leadAudioFile, loadDurationTableFromCache, locateTime, ModelLoadError, readAudiobookIndex, settingsHash, totalDurationSec, withEngine } from '../supertonic';
import type { DurationTable, NarrationSettings, TextToSpeech, VoiceStyle } from '../supertonic';
import { ABBREVIATION } from '../supertonic/text/sentenceRules';
import { useDocumentsStore, useSettingsStore } from '../stores';
import { useTheme } from '../theme';
import type { Chunk } from '../types';
import { stableHash } from '../utils';

// How many upcoming chunks to pre-synthesize so playback doesn't stall at a
// boundary while the next chunk is still being generated.
const PREFETCH_AHEAD = 4;
// Minimum length (chars) of a mid-chunk "lead" so the first clip isn't a tiny
// stutter; a shorter remainder merges forward into the next chunk(s).
const MIN_LEAD = 140;
// "Fast lead": on a fresh, not-yet-cached start, synthesize only the first
// sentence so audio begins in ~1 s; the rest plays after as a "remainder". Only
// worth it when both the lead and the remainder it leaves are large enough.
const MIN_FAST_LEAD = 60;
const MIN_FAST_REMAINDER = 40;
// Extra OS-notification transport buttons (the Android Media3 notification can't
// be themed to match the app).
const LOCK_OPTIONS = { showSeekForward: true, showSeekBackward: true, showSpeed: true } as const;
// loadedKeyRef sentinel for "the concatenated audiobook file is loaded" (vs a
// per-chunk charStart >= 0; -1 means nothing loaded).
const AUDIOBOOK_KEY = -2;

// Media-notification artwork. Media3 derives the notification's colour scheme
// from the large-icon bitmap; without one, contrast falls back to OEM defaults
// (invisible white-on-white on some devices). Resolve the bundled icon to a
// file:// uri once and reuse it as a universal cover.
let artworkPromise: Promise<string | undefined> | null = null;
function resolveArtworkUrl(): Promise<string | undefined> {
  if (!artworkPromise) {
    artworkPromise = (async () => {
      try {
        const asset = Asset.fromModule(require('../../assets/icon.png'));
        if (!asset.localUri) await asset.downloadAsync();
        return asset.localUri ?? asset.uri;
      } catch {
        return undefined;
      }
    })();
  }
  return artworkPromise;
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Perf-tip detection thresholds.
const STALL_MS = 2000; // a boundary gap longer than this = an audible stall
const STALL_TRIGGER = 2; // stalls in a session before offering the tip
const RTF_THRESHOLD = 1.1; // synthesis realtime factor below which we blame the device

function chunkIndexForOffset(chunks: Chunk[], charOffset: number): number {
  const hit = chunks.findIndex((c) => charOffset >= c.charStart && charOffset < c.charEnd);
  if (hit >= 0) return hit;
  return chunks.findIndex((c) => c.charStart >= charOffset);
}

type Lead = { chunk: Chunk; anchorIdx: number; resumeIdx: number };

// The chunk to actually synthesize + play when starting at `charOffset`:
// - tapping at/before a canonical boundary → that whole chunk (best cache reuse);
// - tapping mid-chunk → a one-off chunk from the tap point to the chunk end,
//   merged forward until it's at least MIN_LEAD chars so it plays smoothly.
// `resumeIdx` is the canonical chunk to continue with after this one.
function buildLead(text: string, chunks: Chunk[], charOffset: number): Lead | null {
  if (chunks.length === 0) return null;
  const i = chunkIndexForOffset(chunks, charOffset);
  if (i < 0) return null;
  if (charOffset <= chunks[i].charStart) {
    return { chunk: chunks[i], anchorIdx: i, resumeIdx: i + 1 };
  }
  let j = i;
  while (chunks[j].charEnd - charOffset < MIN_LEAD && j + 1 < chunks.length) j++;
  const charEnd = chunks[j].charEnd;
  const leadText = text.slice(charOffset, charEnd);
  const chunk: Chunk = { idx: i, charStart: charOffset, charEnd, text: leadText, pages: [], textHash: stableHash(leadText) };
  return { chunk, anchorIdx: i, resumeIdx: j + 1 };
}

// End (exclusive) of the first sentence within [start, end), or `end` if no
// sentence break is found at least MIN_FAST_LEAD in. Mirrors the chunker's
// boundary rule (shared sentenceRules): ASCII `.?!` followed by whitespace
// (skipping abbreviations), or a CJK fullwidth terminator unconditionally.
function firstSentenceEnd(text: string, start: number, end: number): number {
  const re = /[.!?。！？]+/g;
  re.lastIndex = start;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) && m.index < end) {
    const stop = m.index + m[0].length;
    if (stop - start < MIN_FAST_LEAD) continue; // too short — keep extending
    if (!/[。！？]/.test(m[0])) {
      if (stop < text.length && !/\s/.test(text[stop])) continue; // mid-token dot
      if (ABBREVIATION.test(text.slice(Math.max(start, m.index - 6), m.index + 1))) continue;
    }
    return Math.min(stop, end);
  }
  return end;
}

type FastStart = { lead: Lead; remainder: Lead | null };

// Splits the start of a fresh playback into a short first-sentence "lead" (fast
// to synthesize) plus the "remainder" of the enclosing chunk. Returns null when
// splitting wouldn't help (offset resolves nowhere, or the remainder is tiny).
function buildFastStart(text: string, chunks: Chunk[], charOffset: number): FastStart | null {
  if (chunks.length === 0) return null;
  const i = chunkIndexForOffset(chunks, charOffset);
  if (i < 0) return null;
  const startAt = Math.max(charOffset, chunks[i].charStart);
  const chunkEnd = chunks[i].charEnd;
  if (chunkEnd - startAt < MIN_FAST_LEAD + MIN_FAST_REMAINDER) return null; // not worth splitting
  const split = firstSentenceEnd(text, startAt, chunkEnd);
  if (split >= chunkEnd || chunkEnd - split < MIN_FAST_REMAINDER) return null; // single sentence — no win
  const mk = (from: number, to: number): Chunk => {
    const t = text.slice(from, to);
    return { idx: i, charStart: from, charEnd: to, text: t, pages: [], textHash: stableHash(t) };
  };
  return {
    lead: { chunk: mk(startAt, split), anchorIdx: i, resumeIdx: i + 1 },
    remainder: { chunk: mk(split, chunkEnd), anchorIdx: i, resumeIdx: i + 1 },
  };
}

export type UsePlaybackOptions = {
  docHash: string; // audio-cache namespace for this document
  chunks: Chunk[]; // canonical, sentence-aligned chunk list from loadChunks
  text: string; // canonical document text — used to build a lead from any offset
  modelId: string | null; // null = none picked yet (engine stays unloaded)
  voiceId: string;
  speed: number;
  steps: number;
  lang?: string;
  title?: string; // lock-screen title
  artist?: string; // lock-screen secondary line (defaults to app name)
  // Routes an OS-notification speed change to the same setter the in-app control
  // uses (per-doc pin or global). Omit to fall back to the global setting.
  onSpeedChange?: (speed: number) => void;
};

export type Playback = {
  ready: boolean;
  modelLoadFailed: boolean; // ONNX sessions failed to load (corrupt files) → reader offers re-download
  playing: boolean;
  loading: boolean; // synthesizing the current chunk (no audio yet)
  engaged: boolean; // a chunk is selected or playback started (drives highlight)
  // True once audio actually started (stays true while paused; cleared on stop /
  // doc switch). Gates the MiniPlayer so it never shows for a mere text selection.
  started: boolean;
  currentChunk: Chunk | null;
  total: number;
  positionSec: number; // within the current clip
  durationSec: number; // of the current clip
  docPositionSec: number; // on the whole-document timeline, at speed (0 until table built)
  docDurationSec: number; // whole-document runtime at speed (0 until built)
  timelineReady: boolean; // duration table ready → whole-doc timeline is meaningful
  perfWarning: boolean; // repeated stalls + slow synthesis → offer the "device is slow" tip
  toggle: () => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  seekToChunk: (index: number) => void;
  select: (charOffset: number) => void; // highlight a lead WITHOUT playing; stops current audio
  playFrom: (charOffset: number) => void; // jump to + play ("play from here")
  goTo: (charOffset: number) => void; // set position from a saved offset WITHOUT playing (resume)
  seek: (fraction: number) => void; // within the current clip (0..1)
  seekToTime: (sec: number) => void; // to an absolute whole-doc time (maps to the enclosing chunk)
  stop: () => void; // hard stop: audio + selection + OS controls
  halt: () => void; // soft stop: audio + OS controls, KEEP selection/position (play resumes)
};

// Sequential, cached, generate-ahead playback. Chunks are large (smooth audio);
// tapping starts at the exact tapped sentence via a one-off "lead" chunk, then
// continues with the canonical chunks after it. Highlight is chunk-level.
export function usePlayback({ docHash, chunks, text, modelId, voiceId, speed, steps, lang = 'en', title, artist, onSpeedChange }: UsePlaybackOptions): Playback {
  // A player we own for the hook's lifetime; useAudioPlayer() released the native
  // player mid-session (replace() threw ERR_USING_RELEASED_SHARED_OBJECT).
  const playerRef = useRef<AudioPlayer | null>(null);
  if (!playerRef.current) {
    playerRef.current = createAudioPlayer();
    playerRef.current.shouldCorrectPitch = true; // keep voice natural when sped up
  }
  const player = playerRef.current;
  const status = useAudioPlayerStatus(player);
  // Themed accent for the OS media notification background.
  const { palette } = useTheme();
  const accentColor = palette.primary;

  const [ready, setReady] = useState(false);
  // Set when the ONNX sessions fail to construct (corrupt model that passed the
  // download checks) → drives the reader's re-download prompt.
  const [modelLoadFailed, setModelLoadFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  // Ref mirror so the background duration-table build can poll "is playback
  // waiting on a clip right now?" and pause itself while it is.
  const loadingRef = useRef(false);
  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);
  const [engaged, setEngaged] = useState(false);
  const [started, setStarted] = useState(false);
  const [current, setCurrent] = useState<Chunk | null>(null);
  // Per-chunk neutral-rate durations for the whole document → the timeline.
  const [durTable, setDurTable] = useState<DurationTable | null>(null);

  const activeRef = useRef(false);
  const finishedHandledRef = useRef(false);
  // Perf-tip detection: when a clip finishes but the next isn't cached, the user
  // waits — time that gap; enough long gaps this session plus a below-realtime
  // synthesis RTF surfaces the "device is slow for this voice" tip.
  const stallStartRef = useRef<number | null>(null);
  const stallCountRef = useRef(0);
  const [perfWarning, setPerfWarning] = useState(false);
  // Bumped by every new play/select/pause so a slow in-flight synthesis can tell
  // it was superseded and must not grab the player.
  const playTokenRef = useRef(0);
  const currentRef = useRef<Chunk | null>(null);
  const anchorIndexRef = useRef(0); // canonical index the current chunk starts in
  const resumeIndexRef = useRef(0); // canonical index to play after the current chunk
  // A "remainder" clip queued to play right after the current fast-lead clip
  // finishes, before resuming canonical chunks. Cleared once consumed.
  const pendingLeadRef = useRef<Lead | null>(null);
  // A neutral-rate seek (seconds) to apply once the next clip finishes loading,
  // set by seekToTime so a timeline scrub lands precisely inside its chunk.
  const pendingSeekRef = useRef<number | null>(null);
  const loadedKeyRef = useRef(-1); // charStart of the audio currently in the player
  // Whether this player currently owns the OS lock-screen / media notification.
  const lockScreenActiveRef = useRef(false);
  // Latest "now playing" metadata in a ref, so the play callback needn't rebuild
  // when title/artist change.
  const lockMetadataRef = useRef<{ title: string; artist: string; albumTitle: string; artworkUrl?: string }>({
    title: 'Document',
    artist: 'Aloud',
    albumTitle: 'Aloud',
  });
  useEffect(() => {
    lockMetadataRef.current = {
      title: title?.trim() || 'Document',
      artist: artist?.trim() || 'Aloud',
      albumTitle: 'Aloud',
      artworkUrl: lockMetadataRef.current.artworkUrl,
    };
    if (lockScreenActiveRef.current) {
      try {
        playerRef.current?.updateLockScreenMetadata?.(lockMetadataRef.current);
      } catch {}
    }
  }, [title, artist]);

  // Resolve the notification artwork once and fold it into the metadata (updating
  // a live notification if one's already showing).
  useEffect(() => {
    let alive = true;
    void resolveArtworkUrl().then((uri) => {
      if (!alive || !uri) return;
      lockMetadataRef.current = { ...lockMetadataRef.current, artworkUrl: uri };
      if (lockScreenActiveRef.current) {
        try {
          playerRef.current?.updateLockScreenMetadata?.(lockMetadataRef.current);
        } catch {}
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const settings = useMemo<NarrationSettings>(
    () => ({ modelId: modelId ?? '', voiceId, speed, steps, lang }),
    [modelId, voiceId, speed, steps, lang],
  );

  // A full audiobook rendered with these exact settings: play straight from cache
  // (no cold-load) and snap starts to chunk boundaries so every clip is a hit.
  const audiobook = useDocumentsStore((s) => s.audiobook[docHash]);
  const fullyRendered = useMemo(
    () => !!modelId && audiobook?.status === 'done' && audiobook.profileHash === settingsHash(settings),
    [modelId, audiobook?.status, audiobook?.profileHash, settings],
  );

  // When a full render is stitched into one file, play it as ONE media item so
  // the OS notification gets a real whole-book timeline + scrubber. Null if the
  // file isn't there (concat failed / still per-chunk) → normal per-chunk path.
  const audiobookUri = useMemo(
    () => (fullyRendered && isAudiobookCached(docHash, settings) ? audiobookAudioUri(docHash, settings) : null),
    [fullyRendered, docHash, settings],
  );
  const singleItem = audiobookUri != null;
  const audiobookLoadedRef = useRef(false);
  // Real per-chunk offsets (s) in the stitched file from the index sidecar — the
  // file's actual clock. Null → fall back to predicted starts.
  const [fileStarts, setFileStarts] = useState<number[] | null>(null);
  useEffect(() => {
    audiobookLoadedRef.current = false; // a new/absent audiobook file must be (re)loaded
    setFileStarts(audiobookUri ? readAudiobookIndex(docHash, settings) : null);
  }, [audiobookUri, docHash, settings]);

  // Configure the audio session once for background playback: shouldPlayInBackground
  // keeps audio alive with the screen off, doNotMix binds the lock-screen to us.
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'doNotMix' }).catch((e) =>
      console.warn('[usePlayback] failed to set audio mode:', e),
    );
  }, []);

  useEffect(() => {
    return () => {
      try {
        playerRef.current?.clearLockScreenControls?.();
      } catch {}
      try {
        playerRef.current?.remove?.();
      } catch {}
      playerRef.current = null;
    };
  }, []);

  // The player outlives any single screen, so switching to a *different* document
  // stops the old one and clears state; reopening the SAME doc leaves it running.
  const prevDocRef = useRef(docHash);
  useEffect(() => {
    if (prevDocRef.current === docHash) return;
    prevDocRef.current = docHash;
    playTokenRef.current++;
    activeRef.current = false;
    finishedHandledRef.current = false;
    player.pause();
    setEngaged(false);
    setStarted(false);
    setCurrent(null);
    currentRef.current = null;
    loadedKeyRef.current = -1;
    anchorIndexRef.current = 0;
    resumeIndexRef.current = 0;
    pendingLeadRef.current = null;
    pendingSeekRef.current = null;
    audiobookLoadedRef.current = false;
    try {
      playerRef.current?.clearLockScreenControls?.();
    } catch {}
    lockScreenActiveRef.current = false;
  }, [docHash, player]);

  // Warm the shared engine when a model is picked. Keyed on modelId only — a voice
  // change reuses the resident engine (the manager caches voices per model).
  useEffect(() => {
    let cancelled = false;
    setModelLoadFailed(false);
    if (!modelId) {
      setReady(false);
      return; // no model picked yet — leave the engine unloaded
    }
    if (fullyRendered) {
      setReady(true); // cached audiobook: skip the cold-load, read clips directly
      return;
    }
    setReady(false);
    getEngine(modelId)
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((e) => {
        console.warn('[usePlayback] failed to load engine:', e);
        // Corrupt model → flag it so the reader can offer a re-download.
        if (!cancelled && e instanceof ModelLoadError) setModelLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [modelId, fullyRendered]);

  // Resolve the shared engine's tts + current voice on demand (null if no model).
  // Cheap once warm; inference goes through `withEngine` for swap safety.
  const ensureEngine = useCallback(async (): Promise<{ tts: TextToSpeech; voice: VoiceStyle } | null> => {
    if (!modelId) return null;
    const tts = await getEngine(modelId);
    const voice = await getVoice(modelId, voiceId);
    return { tts, voice };
  }, [modelId, voiceId]);

  // Build the whole-document duration table (timeline). Reads from disk if cached,
  // else runs the cheap duration predictor over every chunk in the background.
  // Depends only on model/voice/lang, so a speed/steps change just reloads it.
  useEffect(() => {
    let cancelled = false;
    setDurTable(null);
    if (!modelId || chunks.length === 0) return;
    // Fast path: rebuild the timeline from disk (stored table or a full set of
    // per-chunk timing sidecars) with no engine load. Only a doc with un-cached
    // chunks falls through to the predictor below.
    const cached = loadDurationTableFromCache(docHash, chunks, settings);
    if (cached) {
      setDurTable(cached);
      return;
    }
    void (async () => {
      // Let playback claim the engine first — the timeline is never on the
      // critical path, so a brief head start avoids the worst first-play contention.
      await sleep(600);
      if (cancelled) return;
      const engine = await ensureEngine();
      if (!engine || cancelled) return;
      try {
        const table = await withEngine(modelId!, (tts) =>
          ensureDurationTable(tts, engine.voice, docHash, chunks, settings, {
            shouldCancel: () => cancelled,
            // Pause between batches while a clip the user is waiting on synthesizes.
            beforeBatch: async () => {
              while (loadingRef.current && !cancelled) await sleep(120);
            },
          }),
        );
        if (table && !cancelled) setDurTable(table);
      } catch (e) {
        console.warn('[usePlayback] failed to build duration table:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [docHash, chunks, modelId, settings, ensureEngine]);

  const offsets = useMemo(() => (durTable ? cumulativeOffsetsSec(durTable, speed) : null), [durTable, speed]);
  const tableDurationSec = useMemo(() => (durTable ? totalDurationSec(durTable, speed) : 0), [durTable, speed]);

  // Apply the requested playback speed live (cache is rendered at neutral rate).
  useEffect(() => {
    try {
      player.setPlaybackRate(speed, 'high');
    } catch {}
  }, [speed, player]);

  // Mirror a notification-driven speed change (the OS speed button cycles the
  // player's rate directly) back into app state. Only fires on a real divergence.
  useEffect(() => {
    // Only while playing: at load the player can briefly report the default rate
    // before ours is applied, which must not overwrite `speed`.
    if (!status.isLoaded || !status.playing) return;
    const r = status.playbackRate;
    if (r > 0 && Math.abs(r - speed) > 0.02) {
      const rounded = Math.round(r * 100) / 100;
      if (onSpeedChange) onSpeedChange(rounded);
      else useSettingsStore.getState().setSpeed(rounded);
    }
  }, [status.playbackRate, status.isLoaded, status.playing, speed, onSpeedChange]);

  // Apply a queued timeline seek once the freshly-loaded clip reports a duration.
  useEffect(() => {
    if (pendingSeekRef.current == null) return;
    if (!status.isLoaded || status.duration <= 0) return;
    const target = pendingSeekRef.current;
    pendingSeekRef.current = null;
    try {
      void player.seekTo(Math.max(0, Math.min(status.duration, target)));
    } catch {}
  }, [status.isLoaded, status.duration, player]);

  // Claim the OS lock-screen / media notification (idempotent). Called on first
  // audio and when resuming after a halt (which released it).
  const claimLockScreen = useCallback(() => {
    if (lockScreenActiveRef.current) return;
    try {
      // Only a single-file book has a real whole-book duration → show the OS
      // scrubber. Per-chunk playback is marked a live stream so the OS hides the
      // (meaningless, constantly-resetting) timeline.
      player.setActiveForLockScreen(true, lockMetadataRef.current, { ...LOCK_OPTIONS, accentColor, isLiveStream: !singleItem });
      lockScreenActiveRef.current = true;
    } catch (e) {
      console.warn('[usePlayback] failed to activate lock-screen controls:', e);
    }
  }, [player, accentColor, singleItem]);

  // --- Single concatenated-audiobook playback (one media item) ----------------
  // Cumulative NEUTRAL-rate start time (s) of each chunk, mapping a char offset /
  // chunk index to an absolute position in the single audiobook file.
  const neutralStarts = useMemo(() => {
    // Prefer the stitched file's REAL offsets (no cumulative drift); append a
    // synthetic total (last real start + its predicted duration).
    if (fileStarts && durTable && fileStarts.length === durTable.length) {
      const arr = fileStarts.slice();
      arr.push(fileStarts[fileStarts.length - 1] + (durTable[durTable.length - 1] ?? 0));
      return arr;
    }
    if (!durTable) return null;
    const arr = new Array<number>(durTable.length + 1);
    arr[0] = 0;
    for (let i = 0; i < durTable.length; i++) arr[i + 1] = arr[i] + durTable[i];
    return arr;
  }, [fileStarts, durTable]);

  const neutralForOffset = useCallback(
    (charOffset: number): number => {
      if (!neutralStarts) return 0;
      const i = chunkIndexForOffset(chunks, charOffset);
      if (i < 0) return 0;
      const c = chunks[i];
      const span = c.charEnd - c.charStart;
      const frac = span > 0 ? Math.min(1, Math.max(0, (charOffset - c.charStart) / span)) : 0;
      // Interpolate over the chunk's REAL span so a mid-chunk tap lands accurately.
      return neutralStarts[i] + frac * (neutralStarts[i + 1] - neutralStarts[i]);
    },
    [neutralStarts, chunks],
  );

  const ensureAudiobookLoaded = useCallback(() => {
    if (!audiobookUri) return;
    if (!audiobookLoadedRef.current || loadedKeyRef.current !== AUDIOBOOK_KEY) {
      player.replace(audiobookUri);
      try {
        player.setPlaybackRate(speed, 'high');
      } catch {}
      audiobookLoadedRef.current = true;
      loadedKeyRef.current = AUDIOBOOK_KEY;
    }
  }, [audiobookUri, player, speed]);

  // Seek the single audiobook file to a neutral-rate absolute time. If it isn't
  // loaded/measured yet, defer via pendingSeekRef (applied by the effect above).
  const seekNeutralAbs = useCallback(
    (neutralSec: number) => {
      if (status.isLoaded && status.duration > 0 && loadedKeyRef.current === AUDIOBOOK_KEY) {
        try {
          void player.seekTo(Math.max(0, Math.min(status.duration, neutralSec)));
        } catch {}
        pendingSeekRef.current = null;
      } else {
        pendingSeekRef.current = neutralSec;
      }
    },
    [player, status.isLoaded, status.duration],
  );

  // Start the single file playing at a chunk boundary (next/previous/seek-to-chunk).
  const seekToChunkSingle = useCallback(
    (i: number) => {
      if (i < 0 || i >= chunks.length || !neutralStarts) return;
      activeRef.current = true;
      ensureAudiobookLoaded();
      seekNeutralAbs(neutralStarts[i]);
      player.play();
      claimLockScreen();
      setStarted(true);
      setEngaged(true);
    },
    [chunks, neutralStarts, ensureAudiobookLoaded, seekNeutralAbs, player, claimLockScreen],
  );

  const playChunkObject = useCallback(
    async (chunk: Chunk, anchorIdx: number, resumeIdx: number, opts?: { lead?: boolean; next?: Lead | null }) => {
      const lead = opts?.lead ?? false;
      const next = opts?.next ?? null;
      const token = ++playTokenRef.current;
      activeRef.current = true;
      currentRef.current = chunk;
      anchorIndexRef.current = anchorIdx;
      resumeIndexRef.current = resumeIdx;
      // Queue the remainder (if any) to play when this clip finishes.
      pendingLeadRef.current = next;
      setCurrent(chunk);
      setEngaged(true);
      setStarted(true); // audio is now actually engaged → MiniPlayer may show
      // Stop current audio so it doesn't run on while the new chunk synthesizes.
      player.pause();
      try {
        // Fast-lead clips use an ephemeral cache (keyed by length) so they never
        // alias the canonical per-chunk cache; everything else uses it.
        const cached = lead
          ? isLeadCached(docHash, chunk.charStart, chunk.text.length, settings)
          : isChunkCached(docHash, chunk.charStart, settings);
        let uri: string;
        if (cached) {
          // Cache hit — play instantly, no engine, no spinner.
          uri = lead
            ? leadAudioFile(docHash, chunk.charStart, chunk.text.length, settings).uri
            : chunkAudioUri(docHash, chunk.charStart, settings);
        } else {
          setLoading(true);
          const engine = await ensureEngine();
          if (!engine) {
            if (token === playTokenRef.current) setLoading(false);
            return;
          }
          if (token !== playTokenRef.current) return; // superseded while loading
          uri = lead
            ? await withEngine(modelId!, (tts) => ensureLeadAudio(tts, engine.voice, docHash, chunk, settings))
            : await withEngine(modelId!, (tts) => ensureChunkAudio(tts, engine.voice, docHash, chunk, settings));
        }
        if (token !== playTokenRef.current) return; // superseded
        player.replace(uri);
        try {
          player.setPlaybackRate(speed, 'high');
        } catch {}
        loadedKeyRef.current = chunk.charStart;
        player.play();
        claimLockScreen(); // on first audio, so transport appears + background survives
        setLoading(false);
        // Generate-ahead so boundaries don't stall: a queued remainder first (it
        // plays next), then upcoming canonical chunks. Cached items are skipped.
        void (async () => {
          if (next && !isChunkCached(docHash, next.chunk.charStart, settings)) {
            if (token !== playTokenRef.current) return;
            const engine = await ensureEngine();
            if (!engine) return;
            try {
              await withEngine(modelId!, (tts) => ensureChunkAudio(tts, engine.voice, docHash, next.chunk, settings));
            } catch {}
          }
          for (let k = 0; k < PREFETCH_AHEAD; k++) {
            if (token !== playTokenRef.current) return;
            const ahead = chunks[resumeIdx + k];
            if (!ahead) return;
            if (isChunkCached(docHash, ahead.charStart, settings)) continue;
            const engine = await ensureEngine();
            if (!engine) return;
            try {
              await withEngine(modelId!, (tts) => ensureChunkAudio(tts, engine.voice, docHash, ahead, settings));
            } catch {}
          }
          // Cache it now, lowest priority, so re-tapping this chunk later plays
          // from cache instead of re-synthesizing a lead. )
          if (lead) {
            const enclosing = chunks[anchorIdx];
            if (enclosing && !isChunkCached(docHash, enclosing.charStart, settings)) {
              if (token !== playTokenRef.current) return;
              const engine = await ensureEngine();
              if (engine) {
                try {
                  await withEngine(modelId!, (tts) => ensureChunkAudio(tts, engine.voice, docHash, enclosing, settings));
                } catch {}
              }
            }
          }
        })();
      } catch (e) {
        if (token === playTokenRef.current) setLoading(false);
        console.warn('[usePlayback] failed to play chunk at', chunk.charStart, e);
      }
    },
    [chunks, docHash, player, settings, speed, ensureEngine, claimLockScreen, modelId],
  );

  const playCanonical = useCallback(
    (i: number) => {
      if (i < 0 || i >= chunks.length) return;
      void playChunkObject(chunks[i], i, i + 1);
    },
    [chunks, playChunkObject],
  );

  useEffect(() => {
    if (singleItem) {
      // The one file plays straight through — "finish" means end of the book.
      if (status.didJustFinish && !finishedHandledRef.current) {
        finishedHandledRef.current = true;
        activeRef.current = false;
      }
      if (!status.didJustFinish) finishedHandledRef.current = false;
      return;
    }
    if (status.didJustFinish && !finishedHandledRef.current) {
      finishedHandledRef.current = true;
      if (!activeRef.current) return;
      const pending = pendingLeadRef.current;
      if (pending) {
        // A fast-lead just finished — play the remainder of its chunk next.
        if (!isChunkCached(docHash, pending.chunk.charStart, settings)) stallStartRef.current = Date.now();
        pendingLeadRef.current = null;
        void playChunkObject(pending.chunk, pending.anchorIdx, pending.resumeIdx);
      } else {
        const next = resumeIndexRef.current;
        if (next < chunks.length) {
          if (!isChunkCached(docHash, chunks[next].charStart, settings)) stallStartRef.current = Date.now();
          playCanonical(next);
        } else activeRef.current = false;
      }
    }
    if (!status.didJustFinish) finishedHandledRef.current = false;
  }, [singleItem, status.didJustFinish, chunks.length, playCanonical, playChunkObject, docHash, settings]);

  // Perf-tip: when audio resumes after a non-cached boundary, measure the gap;
  // enough long gaps + a below-realtime RTF surfaces the tip.
  useEffect(() => {
    if (singleItem || stallStartRef.current == null || !status.isLoaded || !status.playing) return;
    const gap = Date.now() - stallStartRef.current;
    stallStartRef.current = null;
    if (gap <= STALL_MS) return;
    stallCountRef.current += 1;
    if (stallCountRef.current >= STALL_TRIGGER && !perfWarning) {
      const rtf = getSynthRtf(modelId);
      if (rtf != null && rtf < RTF_THRESHOLD) setPerfWarning(true);
    }
  }, [singleItem, status.isLoaded, status.playing, modelId, perfWarning]);

  // Single-item highlight: derive the current chunk from the file's play position
  // (via the duration table) so the reader highlight tracks playback.
  useEffect(() => {
    if (!singleItem || !neutralStarts || !status.isLoaded) return;
    const t = status.currentTime;
    let lo = 0;
    let hi = chunks.length - 1;
    let idx = 0;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (neutralStarts[mid] <= t) {
        idx = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (chunks[idx] && currentRef.current !== chunks[idx]) {
      currentRef.current = chunks[idx];
      anchorIndexRef.current = idx;
      setCurrent(chunks[idx]);
    }
  }, [singleItem, neutralStarts, status.currentTime, status.isLoaded, chunks]);

  // Begin a fresh start with a fast first-sentence lead (~1 s to audio). Returns
  // false (caller falls back) when a lead won't help: already-instant audiobook,
  // an already-cached chunk, or text that can't be usefully split.
  const startFast = useCallback(
    (charOffset: number): boolean => {
      if (fullyRendered) return false;
      const fs = buildFastStart(text, chunks, charOffset);
      if (!fs) return false;
      const enclosing = chunks[fs.lead.anchorIdx];
      if (enclosing && isChunkCached(docHash, enclosing.charStart, settings)) return false;
      void playChunkObject(fs.lead.chunk, fs.lead.anchorIdx, fs.lead.resumeIdx, { lead: true, next: fs.remainder });
      return true;
    },
    [fullyRendered, text, chunks, docHash, settings, playChunkObject],
  );

  const play = useCallback(() => {
    activeRef.current = true;
    setEngaged(true);
    if (singleItem) {
      ensureAudiobookLoaded(); // one media item: load once, resume in place

      player.play();
      claimLockScreen();
      setStarted(true);
      return;
    }
    const cur = currentRef.current;
    if (cur && status.isLoaded && loadedKeyRef.current === cur.charStart && !status.playing) {
      player.play(); // resume the current chunk in place
      claimLockScreen(); // a prior halt released the OS controls — bring them back
    } else if (cur) {
      if (!startFast(cur.charStart)) void playChunkObject(cur, anchorIndexRef.current, resumeIndexRef.current);
    } else if (chunks.length) {
      if (!startFast(chunks[0].charStart)) playCanonical(0); // nothing selected → start from the top
    }
  }, [singleItem, ensureAudiobookLoaded, playChunkObject, playCanonical, startFast, player, status.isLoaded, status.playing, chunks, claimLockScreen]);

  const pause = useCallback(() => {
    activeRef.current = false;
    playTokenRef.current++; // cancel any in-flight load so it can't auto-start
    setLoading(false);
    player.pause();
  }, [player]);

  const toggle = useCallback(() => {
    if (status.playing) pause();
    else play();
  }, [status.playing, play, pause]);

  const next = useCallback(() => {
    if (singleItem) return seekToChunkSingle(anchorIndexRef.current + 1);
    playCanonical(resumeIndexRef.current);
  }, [singleItem, seekToChunkSingle, playCanonical]);
  const previous = useCallback(() => {
    if (singleItem) return seekToChunkSingle(Math.max(0, anchorIndexRef.current - 1));
    playCanonical(Math.max(0, anchorIndexRef.current - 1));
  }, [singleItem, seekToChunkSingle, playCanonical]);
  const seekToChunk = useCallback(
    (i: number) => {
      if (singleItem) return seekToChunkSingle(i);
      playCanonical(i);
    },
    [singleItem, seekToChunkSingle, playCanonical],
  );

  // Where to start for a tapped/resumed offset: a cached audiobook snaps to the
  // enclosing canonical chunk (always a hit); otherwise build a mid-sentence lead.
  const resolveStart = useCallback(
    (charOffset: number): Lead | null => {
      if (fullyRendered) {
        const i = chunkIndexForOffset(chunks, charOffset);
        if (i < 0) return null;
        return { chunk: chunks[i], anchorIdx: i, resumeIdx: i + 1 };
      }
      return buildLead(text, chunks, charOffset);
    },
    [fullyRendered, text, chunks],
  );

  const setSelection = useCallback(
    (charOffset: number, stopCurrent: boolean) => {
      if (singleItem) {
        // Seek the one file to the tapped position; reflect the chunk as selected.
        if (stopCurrent) {
          activeRef.current = false;
          player.pause();
        }
        ensureAudiobookLoaded();
        seekNeutralAbs(neutralForOffset(charOffset));
        const i = chunkIndexForOffset(chunks, charOffset);
        if (i >= 0) {
          currentRef.current = chunks[i];
          anchorIndexRef.current = i;
          setCurrent(chunks[i]);
        }
        setEngaged(true);
        return;
      }
      const lead = resolveStart(charOffset);
      if (!lead) return;
      if (stopCurrent) {
        playTokenRef.current++;
        activeRef.current = false;
        pendingLeadRef.current = null;
        pendingSeekRef.current = null;
        setLoading(false);
        player.pause();
      }
      currentRef.current = lead.chunk;
      anchorIndexRef.current = lead.anchorIdx;
      resumeIndexRef.current = lead.resumeIdx;
      setCurrent(lead.chunk);
      setEngaged(true);
    },
    [singleItem, resolveStart, player, ensureAudiobookLoaded, seekNeutralAbs, neutralForOffset, chunks],
  );

  const select = useCallback((charOffset: number) => setSelection(charOffset, true), [setSelection]);
  const goTo = useCallback((charOffset: number) => setSelection(charOffset, false), [setSelection]);

  const playFrom = useCallback(
    (charOffset: number) => {
      if (singleItem) {
        activeRef.current = true;
        ensureAudiobookLoaded();
        seekNeutralAbs(neutralForOffset(charOffset));
        player.play();
        claimLockScreen();
        setStarted(true);
        setEngaged(true);
        return;
      }
      if (startFast(charOffset)) return;
      const lead = resolveStart(charOffset);
      if (lead) void playChunkObject(lead.chunk, lead.anchorIdx, lead.resumeIdx);
    },
    [singleItem, ensureAudiobookLoaded, seekNeutralAbs, neutralForOffset, player, claimLockScreen, startFast, resolveStart, playChunkObject],
  );

  // Hard stop (the "Stop" action): halt audio, drop the selection, release the OS
  // controls so nothing lingers in the notification.
  const stop = useCallback(() => {
    playTokenRef.current++;
    activeRef.current = false;
    finishedHandledRef.current = false;
    setLoading(false);
    player.pause();
    try {
      void player.seekTo(0);
    } catch {}
    setEngaged(false);
    setStarted(false);
    setCurrent(null);
    currentRef.current = null;
    loadedKeyRef.current = -1;
    pendingLeadRef.current = null;
    pendingSeekRef.current = null;
    try {
      playerRef.current?.clearLockScreenControls?.();
    } catch {}
    lockScreenActiveRef.current = false;
  }, [player]);

  // Soft stop (mini-player's square): halt audio + release the notification, but
  // KEEP selection/position/`started` so play resumes in place.
  const halt = useCallback(() => {
    playTokenRef.current++; // cancel any in-flight load so it can't auto-start
    activeRef.current = false;
    setLoading(false);
    player.pause();
    try {
      playerRef.current?.clearLockScreenControls?.();
    } catch {}
    lockScreenActiveRef.current = false;
  }, [player]);

  const seek = useCallback(
    (fraction: number) => {
      if (status.isLoaded && status.duration > 0) {
        void player.seekTo(Math.max(0, Math.min(1, fraction)) * status.duration);
      }
    },
    [player, status.isLoaded, status.duration],
  );

  // Seek to an absolute whole-document time: locate the enclosing chunk, queue a
  // precise within-chunk seek, then start it (snaps to a canonical cache unit).
  const seekToTime = useCallback(
    (sec: number) => {
      if (!durTable) return;
      if (singleItem) {
        // `sec` is at-speed timeline; the file is neutral-rate, so scale back up.
        activeRef.current = true;
        ensureAudiobookLoaded();
        seekNeutralAbs(sec * speed);
        player.play();
        claimLockScreen();
        setStarted(true);
        setEngaged(true);
        return;
      }
      const loc = locateTime(durTable, speed, sec);
      if (!loc) return;
      activeRef.current = true;
      // Fast-start at the dropped position (startFast declines and we fall back to
      // playing the whole chunk when it's already cached or can't be split).
      const c = chunks[loc.index];
      const span = c ? c.charEnd - c.charStart : 0;
      const frac = durTable[loc.index] > 0 ? Math.min(1, Math.max(0, loc.withinNeutralSec / durTable[loc.index])) : 0;
      const charOffset = c ? c.charStart + Math.floor(frac * span) : 0;
      if (!c || !startFast(charOffset)) {
        pendingLeadRef.current = null;
        pendingSeekRef.current = loc.withinNeutralSec;
        playCanonical(loc.index);
      }
    },
    [durTable, singleItem, ensureAudiobookLoaded, seekNeutralAbs, speed, player, claimLockScreen, playCanonical, startFast, chunks],
  );

  // Map the current clip's position onto the whole-document timeline. The clip may
  // be a canonical chunk, a fast-lead, or a remainder, so offset by the canonical
  // start plus the lead already played (by char proportion). Neutral secs → /speed.
  let docPositionSec = 0;
  let docDurationSec = tableDurationSec;
  if (singleItem && status.isLoaded) {
    // The file IS the whole book (neutral time) — use its real clock so the
    // scrubber matches the OS notification. /speed → at-speed timeline.
    docPositionSec = status.currentTime / speed;
    if (status.duration > 0) docDurationSec = status.duration / speed;
  } else if (offsets && durTable) {
    const ai = anchorIndexRef.current;
    if (ai >= 0 && ai < offsets.length) {
      const canonical = chunks[ai];
      const clip = currentRef.current;
      let leadNeutral = 0;
      if (canonical && clip && canonical.charEnd > canonical.charStart) {
        const leadChars = Math.max(0, clip.charStart - canonical.charStart);
        leadNeutral = durTable[ai] * Math.min(1, leadChars / (canonical.charEnd - canonical.charStart));
      }
      const curTime = status.isLoaded ? status.currentTime : 0;
      docPositionSec = offsets[ai] + (leadNeutral + curTime) / speed;
    }
  }

  return {
    ready,
    modelLoadFailed,
    playing: status.playing,
    loading,
    engaged,
    started,
    currentChunk: current,
    total: chunks.length,
    positionSec: status.currentTime,
    durationSec: status.duration,
    docPositionSec,
    docDurationSec,
    timelineReady: durTable != null,
    perfWarning,
    toggle,
    play,
    pause,
    next,
    previous,
    seekToChunk,
    select,
    playFrom,
    goTo,
    seek,
    seekToTime,
    stop,
    halt,
  };
}
