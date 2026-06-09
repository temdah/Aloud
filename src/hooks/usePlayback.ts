import { createAudioPlayer, setAudioModeAsync, useAudioPlayerStatus, type AudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { chunkAudioUri, cumulativeOffsetsSec, ensureChunkAudio, ensureDurationTable, ensureLeadAudio, ensureModelsDownloaded, isChunkCached, isLeadCached, leadWavFile, loadDurationTable, loadTextToSpeech, loadVoiceStyle, locateTime, settingsHash, totalDurationSec } from '../supertonic';
import type { DurationTable, NarrationSettings, TextToSpeech, VoiceStyle } from '../supertonic';
import { useDocumentsStore } from '../stores';
import type { Chunk } from '../types';
import { stableHash } from '../utils';

// How many upcoming chunks to pre-synthesize so playback doesn't stall at a
// boundary while the next chunk is still being generated.
const PREFETCH_AHEAD = 4;
// Minimum length (chars) of a mid-chunk "lead" so the first clip isn't a tiny
// stutter; a shorter remainder merges forward into the next chunk(s).
const MIN_LEAD = 140;
// "Fast lead": when starting fresh on a not-yet-cached chunk, synthesize only the
// first sentence first so audio begins in ~1 s instead of after the whole chunk.
// The rest of the chunk plays right after as a "remainder" clip. We only bother
// when the lead is at least this long (avoid a 3-word stutter) AND the remainder
// it leaves behind is worth splitting out (else just render the whole chunk).
const MIN_FAST_LEAD = 60;
const MIN_FAST_REMAINDER = 40;
// Lock-screen transport extras. Android renders an OS Media3 notification (it
// can't be themed to match the app); these add seek buttons beside play/pause.
const LOCK_OPTIONS = { showSeekForward: true, showSeekBackward: true } as const;

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
// boundary rule: a `.?!` followed by whitespace, ignoring common abbreviations.
function firstSentenceEnd(text: string, start: number, end: number): number {
  const re = /[.!?]+/g;
  re.lastIndex = start;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) && m.index < end) {
    const stop = m.index + m[0].length;
    if (stop - start < MIN_FAST_LEAD) continue; // too short — keep extending
    if (stop < text.length && !/\s/.test(text[stop])) continue; // mid-token dot
    if (/\b(?:mr|mrs|ms|dr|prof|sr|jr|vs|inc|ltd|co|corp|st|ave|blvd|e\.g|i\.e|etc)\.$/i.test(text.slice(Math.max(start, m.index - 6), m.index + 1)))
      continue;
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
  /** PDF content hash — the audio-cache namespace for this document. */
  docHash: string;
  /** Canonical chunk list (large, sentence-aligned) from loadChunks. */
  chunks: Chunk[];
  /** Canonical document text — used to build a lead chunk from any offset. */
  text: string;
  /** Active model build id; null = none picked yet (engine stays unloaded). */
  modelId: string | null;
  voiceId: string;
  speed: number;
  steps: number;
  lang?: string;
  /** Document title shown on the lock-screen / media notification. */
  title?: string;
  /** Secondary line on the lock-screen (defaults to the app name). */
  artist?: string;
};

export type Playback = {
  ready: boolean;
  playing: boolean;
  /** True while the current chunk's audio is being synthesized (no audio yet). */
  loading: boolean;
  /** True once a chunk is selected or playback has started (drives highlight). */
  engaged: boolean;
  /** True once audio has actually started for this document (stays true while
   *  paused, cleared on stop / document switch). Gates the global MiniPlayer so
   *  it never shows for a mere text selection that hasn't played. */
  started: boolean;
  /** The chunk currently playing/selected (a canonical chunk or a tap-start lead). */
  currentChunk: Chunk | null;
  total: number;
  /** Position within the CURRENT clip (per-chunk). */
  positionSec: number;
  /** Duration of the CURRENT clip (per-chunk). */
  durationSec: number;
  /** Position on the WHOLE-document timeline, in seconds at the active speed.
   *  0 until the duration table is built. */
  docPositionSec: number;
  /** Whole-document runtime in seconds at the active speed (0 until built). */
  docDurationSec: number;
  /** True once the duration table is ready (whole-doc timeline is meaningful). */
  timelineReady: boolean;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  seekToChunk: (index: number) => void;
  /** Select (highlight) a lead starting at this global char offset, WITHOUT
   *  playing; stops any current audio. Press play to start from the selection. */
  select: (charOffset: number) => void;
  /** Jump to + play a lead starting at this offset (used for "play from here"). */
  playFrom: (charOffset: number) => void;
  /** Set the current position from a saved offset WITHOUT playing (resume). */
  goTo: (charOffset: number) => void;
  /** Seek within the current chunk's audio (fraction 0..1 of its duration). */
  seek: (fraction: number) => void;
  /** Seek to an absolute time on the whole-document timeline (seconds, at speed):
   *  maps to the enclosing chunk, starts it, and seeks within it. */
  seekToTime: (sec: number) => void;
  /** Fully halt playback: stop audio, drop the selection, release the OS controls. */
  stop: () => void;
};

// Sequential, cached, generate-ahead playback. Chunks are large (smooth audio);
// tapping starts at the exact tapped sentence via a one-off "lead" chunk, then
// continues with the canonical chunks after it. Highlight is chunk-level.
export function usePlayback({ docHash, chunks, text, modelId, voiceId, speed, steps, lang = 'en', title, artist }: UsePlaybackOptions): Playback {
  // A player we own for the hook's lifetime (created once, released on unmount):
  // useAudioPlayer() released the native player mid-session (replace() failed
  // with ERR_USING_RELEASED_SHARED_OBJECT).
  const playerRef = useRef<AudioPlayer | null>(null);
  if (!playerRef.current) {
    playerRef.current = createAudioPlayer();
    playerRef.current.shouldCorrectPitch = true; // keep voice natural when sped up
  }
  const player = playerRef.current;
  const status = useAudioPlayerStatus(player);

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [started, setStarted] = useState(false);
  const [current, setCurrent] = useState<Chunk | null>(null);
  // Per-chunk neutral-rate durations for the whole document → the timeline.
  const [durTable, setDurTable] = useState<DurationTable | null>(null);

  const engineRef = useRef<{ tts: TextToSpeech; voice: VoiceStyle } | null>(null);
  const activeRef = useRef(false);
  const finishedHandledRef = useRef(false);
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
  // Latest "now playing" metadata; kept in a ref so the play callback doesn't
  // need to be re-created when the title/artist change.
  const lockMetadataRef = useRef<{ title: string; artist: string; albumTitle: string }>({
    title: 'Document',
    artist: 'Aloud',
    albumTitle: 'Aloud',
  });
  useEffect(() => {
    lockMetadataRef.current = {
      title: title?.trim() || 'Document',
      artist: artist?.trim() || 'Aloud',
      albumTitle: 'Aloud',
    };
    if (lockScreenActiveRef.current) {
      try {
        playerRef.current?.updateLockScreenMetadata?.(lockMetadataRef.current);
      } catch {}
    }
  }, [title, artist]);

  const settings = useMemo<NarrationSettings>(
    () => ({ modelId: modelId ?? '', voiceId, speed, steps, lang }),
    [modelId, voiceId, speed, steps, lang],
  );

  // A book whose full audiobook finished rendering with these exact settings: we
  // can play straight from cache (no engine cold-load, no "loading" spinner) and
  // snap starts to canonical chunk boundaries so every clip is a cache hit.
  const audiobook = useDocumentsStore((s) => s.audiobook[docHash]);
  const fullyRendered = useMemo(
    () => !!modelId && audiobook?.status === 'done' && audiobook.profileHash === settingsHash(settings),
    [modelId, audiobook?.status, audiobook?.profileHash, settings],
  );

  // Configure the audio session once for sustained background playback.
  // `shouldPlayInBackground` keeps audio alive when the screen is off, and
  // `doNotMix` is required for the OS to bind the lock-screen controls to us.
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

  // The player now outlives any single screen (it lives in the global provider),
  // so switching to a *different* document must stop the old one and clear the
  // selection/lock-screen. Reopening the SAME document leaves playback running.
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
    try {
      playerRef.current?.clearLockScreenControls?.();
    } catch {}
    lockScreenActiveRef.current = false;
  }, [docHash, player]);

  useEffect(() => {
    let cancelled = false;
    engineRef.current = null;
    if (!modelId) {
      setReady(false);
      return; // no model picked yet — leave the engine unloaded
    }
    if (fullyRendered) {
      // Cached audiobook: don't pay the ONNX cold-load — playback reads WAVs
      // directly. The engine lazy-loads only if some clip is unexpectedly missing.
      setReady(true);
      return;
    }
    setReady(false);
    loadEngine(modelId, voiceId)
      .then((engine) => {
        if (cancelled) return;
        engineRef.current = engine;
        setReady(true);
      })
      .catch((e) => console.warn('[usePlayback] failed to load engine/voice:', e));
    return () => {
      cancelled = true;
    };
  }, [modelId, voiceId, fullyRendered]);

  // Lazily load the engine on demand (cache miss while otherwise running from
  // cache). Returns null if no model is selected.
  const ensureEngine = useCallback(async (): Promise<{ tts: TextToSpeech; voice: VoiceStyle } | null> => {
    if (engineRef.current) return engineRef.current;
    if (!modelId) return null;
    const engine = await loadEngine(modelId, voiceId);
    engineRef.current = engine;
    return engine;
  }, [modelId, voiceId]);

  // Build the whole-document duration table for the timeline. Reads instantly
  // from disk if cached for this model/voice/lang; otherwise runs the cheap
  // duration predictor (no synthesis) over every chunk in the background. Depends
  // only on model/voice/lang, so a speed/steps change just reloads the cache.
  useEffect(() => {
    let cancelled = false;
    setDurTable(null);
    if (!modelId || chunks.length === 0) return;
    const cached = loadDurationTable(docHash, chunks.length, settings);
    if (cached) {
      setDurTable(cached);
      return;
    }
    void (async () => {
      const engine = await ensureEngine();
      if (!engine || cancelled) return;
      try {
        const table = await ensureDurationTable(engine.tts, engine.voice, docHash, chunks, settings, {
          shouldCancel: () => cancelled,
        });
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
  const docDurationSec = useMemo(() => (durTable ? totalDurationSec(durTable, speed) : 0), [durTable, speed]);

  // Apply the requested playback speed live (cache is rendered at neutral rate).
  useEffect(() => {
    try {
      player.setPlaybackRate(speed, 'high');
    } catch {}
  }, [speed, player]);

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
      // Stop whatever is playing right now so it doesn't keep going while the
      // newly requested chunk synthesizes (e.g. after "play from here").
      player.pause();
      try {
        // Fast-lead clips live in an ephemeral cache (keyed by length) so they
        // never alias the canonical per-chunk cache; everything else uses it.
        const cached = lead
          ? isLeadCached(docHash, chunk.charStart, chunk.text.length, settings)
          : isChunkCached(docHash, chunk.charStart, settings);
        let uri: string;
        if (cached) {
          // Cache hit — play instantly, no engine and no "loading" spinner.
          uri = lead
            ? leadWavFile(docHash, chunk.charStart, chunk.text.length, settings).uri
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
            ? await ensureLeadAudio(engine.tts, engine.voice, docHash, chunk, settings)
            : await ensureChunkAudio(engine.tts, engine.voice, docHash, chunk, settings);
        }
        if (token !== playTokenRef.current) return; // superseded
        player.replace(uri);
        try {
          player.setPlaybackRate(speed, 'high');
        } catch {}
        loadedKeyRef.current = chunk.charStart;
        player.play();
        // Claim the lock-screen / media notification on first audio so transport
        // controls appear and background playback is sustained past ~3 min.
        if (!lockScreenActiveRef.current) {
          try {
            player.setActiveForLockScreen(true, lockMetadataRef.current, LOCK_OPTIONS);
            lockScreenActiveRef.current = true;
          } catch (e) {
            console.warn('[usePlayback] failed to activate lock-screen controls:', e);
          }
        }
        setLoading(false);
        // Generate-ahead so boundaries don't stall. A queued remainder is the
        // most urgent (it plays next), then the upcoming canonical chunks.
        // Cached items are skipped; the engine lazy-loads only if one is missing.
        void (async () => {
          if (next && !isChunkCached(docHash, next.chunk.charStart, settings)) {
            if (token !== playTokenRef.current) return;
            const engine = await ensureEngine();
            if (!engine) return;
            try {
              await ensureChunkAudio(engine.tts, engine.voice, docHash, next.chunk, settings);
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
              await ensureChunkAudio(engine.tts, engine.voice, docHash, ahead, settings);
            } catch {}
          }
        })();
      } catch (e) {
        if (token === playTokenRef.current) setLoading(false);
        console.warn('[usePlayback] failed to play chunk at', chunk.charStart, e);
      }
    },
    [chunks, docHash, player, settings, speed, ensureEngine],
  );

  const playCanonical = useCallback(
    (i: number) => {
      if (i < 0 || i >= chunks.length) return;
      void playChunkObject(chunks[i], i, i + 1);
    },
    [chunks, playChunkObject],
  );

  useEffect(() => {
    if (status.didJustFinish && !finishedHandledRef.current) {
      finishedHandledRef.current = true;
      if (!activeRef.current) return;
      const pending = pendingLeadRef.current;
      if (pending) {
        // A fast-lead just finished — play the remainder of its chunk next.
        pendingLeadRef.current = null;
        void playChunkObject(pending.chunk, pending.anchorIdx, pending.resumeIdx);
      } else {
        const next = resumeIndexRef.current;
        if (next < chunks.length) playCanonical(next);
        else activeRef.current = false;
      }
    }
    if (!status.didJustFinish) finishedHandledRef.current = false;
  }, [status.didJustFinish, chunks.length, playCanonical, playChunkObject]);

  // Try to begin a fresh start with a fast first-sentence lead so audio starts in
  // ~1 s. Returns false (caller falls back to the normal path) when a lead won't
  // help: a fully-rendered audiobook (already instant), a chunk that's already
  // cached, or text that can't be usefully split.
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
    const cur = currentRef.current;
    if (cur && status.isLoaded && loadedKeyRef.current === cur.charStart && !status.playing) {
      player.play(); // resume the current chunk in place
    } else if (cur) {
      if (!startFast(cur.charStart)) void playChunkObject(cur, anchorIndexRef.current, resumeIndexRef.current);
    } else if (chunks.length) {
      if (!startFast(chunks[0].charStart)) playCanonical(0); // nothing selected → start from the top
    }
  }, [playChunkObject, playCanonical, startFast, player, status.isLoaded, status.playing, chunks]);

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

  const next = useCallback(() => playCanonical(resumeIndexRef.current), [playCanonical]);
  const previous = useCallback(() => playCanonical(Math.max(0, anchorIndexRef.current - 1)), [playCanonical]);
  const seekToChunk = useCallback((i: number) => playCanonical(i), [playCanonical]);

  // Where to actually start for a tapped/resumed offset. A fully-cached audiobook
  // snaps to the enclosing canonical chunk (always a cache hit, no synthesis);
  // otherwise it builds a precise mid-sentence lead.
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
    [resolveStart, player],
  );

  const select = useCallback((charOffset: number) => setSelection(charOffset, true), [setSelection]);
  const goTo = useCallback((charOffset: number) => setSelection(charOffset, false), [setSelection]);

  const playFrom = useCallback(
    (charOffset: number) => {
      if (startFast(charOffset)) return;
      const lead = resolveStart(charOffset);
      if (lead) void playChunkObject(lead.chunk, lead.anchorIdx, lead.resumeIdx);
    },
    [startFast, resolveStart, playChunkObject],
  );

  // Hard stop: halt audio, drop the selection, and release the OS media controls
  // so nothing lingers in the notification. (The "Stop" transport action.)
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

  const seek = useCallback(
    (fraction: number) => {
      if (status.isLoaded && status.duration > 0) {
        void player.seekTo(Math.max(0, Math.min(1, fraction)) * status.duration);
      }
    },
    [player, status.isLoaded, status.duration],
  );

  // Seek to an absolute position on the whole-document timeline: locate the
  // enclosing chunk, queue a precise within-chunk seek, then start that chunk.
  // Snaps to a canonical chunk so it's always a clean cache unit.
  const seekToTime = useCallback(
    (sec: number) => {
      if (!durTable) return;
      const loc = locateTime(durTable, speed, sec);
      if (!loc) return;
      activeRef.current = true;
      pendingLeadRef.current = null;
      pendingSeekRef.current = loc.withinNeutralSec;
      playCanonical(loc.index);
    },
    [durTable, speed, playCanonical],
  );

  // Map the current clip's position onto the whole-document timeline. The clip
  // may be a full canonical chunk, a fast-lead, or a remainder, so we offset by
  // the canonical chunk's start time plus the lead portion already played before
  // this clip (estimated by char proportion). Neutral seconds → /speed for docs.
  let docPositionSec = 0;
  if (offsets && durTable) {
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
  };
}

async function loadEngine(modelId: string, voiceId: string): Promise<{ tts: TextToSpeech; voice: VoiceStyle }> {
  // Safety-net: only the model's *download-time* voice style JSON is fetched up
  // front, so switching to any other voice would otherwise leave its ~150 KB
  // style file missing and loadVoiceStyle would throw (silent no-audio). This
  // fetches the selected voice's file if absent (model files are skipped).
  await ensureModelsDownloaded(modelId, voiceId);
  const tts = await loadTextToSpeech(modelId);
  const voice = await loadVoiceStyle(modelId, voiceId);
  return { tts, voice };
}
