import { createAudioPlayer, setAudioModeAsync, useAudioPlayerStatus, type AudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audiobookAudioUri, buildTimeline, chunkAudioUri, cumulativeOffsetsSec, ensureChunkAudio, ensureLeadAudio, findChunkIndexForOffset, getEngine, getVoice, isAudiobookCached, getSynthRtf, isChunkCached, isLeadCached, leadAudioFile, locateTime, ModelLoadError, readAudiobookIndex, settingsHash, totalDurationSec, withEngine } from '../supertonic';
import type { DurationTable, NarrationSettings, NarrationSynthesisMetrics, TextToSpeech, VoiceStyle } from '../supertonic';
import {
  buildFastStart,
  buildLead,
  cancelPlaybackTrace,
  failPlaybackTrace,
  finishPlaybackTrace,
  markPlaybackCacheDecision,
  markPlaybackPlayerLoaded,
  markPlaybackPlayerRequested,
  markPlaybackPrepared,
  prefetchDepth,
  recordBoundaryGap,
  recordPrefetchDepth,
  startPlaybackTrace,
  type Lead,
  type PlaybackCacheDecision,
  type PlaybackRequestKind,
} from '../playback';
import { useDocumentsStore, useSettingsStore } from '../stores';
import { useTheme } from '../theme';
import type { Chunk } from '../types';
import { resolvePlaybackArtworkUrl } from '../playback/playbackArtwork';
import { buildNeutralStarts, neutralTimeForOffset } from '../playback/playbackTimeline';
import type { Playback, UsePlaybackOptions } from '../playback/playbackTypes';

export type { Playback, UsePlaybackOptions } from '../playback/playbackTypes';
// Extra OS-notification transport buttons (the Android Media3 notification can't
// be themed to match the app).
const LOCK_OPTIONS = { showSeekForward: true, showSeekBackward: true, showSpeed: true } as const;
// loadedKeyRef sentinel for "the concatenated audiobook file is loaded" (vs a
// per-chunk charStart >= 0; -1 means nothing loaded).
const AUDIOBOOK_KEY = -2;

// Perf-tip detection thresholds.
const STALL_MS = 2000; // a boundary gap longer than this = an audible stall
const STALL_TRIGGER = 2; // stalls in a session before offering the tip
const RTF_THRESHOLD = 1.1; // synthesis realtime factor below which we blame the device

// Sequential, cached, generate-ahead playback. Chunks are large (smooth audio);
// tapping starts at the exact tapped sentence via a one-off "lead" chunk, then
// continues with the canonical chunks after it. Highlight is chunk-level.
export function usePlayback({ docHash, plan, modelId, voiceId, speed, steps, lang = 'en', quality, title, artist, onSpeedChange }: UsePlaybackOptions): Playback {
  const { chunks, text } = plan;
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
  // Latest production playback request being measured. The metrics buffer is
  // module-scoped so the developer lab can inspect it after leaving the reader.
  const playbackTraceRef = useRef<number | null>(null);
  const boundaryGapRef = useRef<{ startedAtMs: number; nextWasCached: boolean } | null>(null);
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
    void resolvePlaybackArtworkUrl().then((uri) => {
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
    () => ({ modelId: modelId ?? '', voiceId, speed, steps, lang, quality }),
    [modelId, voiceId, speed, steps, lang, quality],
  );
  // Timeline durations are neutral-rate and their cache ignores speed. Keep a
  // stable settings object so moving the speed control never probes every chunk.
  const timelineSettings = useMemo<NarrationSettings>(
    () => ({ modelId: modelId ?? '', voiceId, speed: 1, steps, lang, quality }),
    [modelId, voiceId, steps, lang, quality],
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
    if (playbackTraceRef.current != null) cancelPlaybackTrace(playbackTraceRef.current);
    playbackTraceRef.current = null;
    boundaryGapRef.current = null;
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

  // Whole-document timeline for the scrubber. Built instantly with no engine —
  // real cached clip lengths where we have them, a char estimate for the rest —
  // so it never delays playback or competes with the clip the user is waiting on.
  useEffect(() => {
    setDurTable(chunks.length === 0 ? null : buildTimeline(docHash, chunks, timelineSettings));
  }, [docHash, chunks, timelineSettings]);

  // Warm the clip the user will hear first — the lead for the resume/selected
  // position (or chunk 0) — while the engine is idle and they're still reading,
  // so pressing play is instant. Dedup means play attaches to this same synth.
  const warmedRef = useRef<string | null>(null);
  const warmStart = useCallback(
    async (charOffset: number) => {
      const token = playTokenRef.current;
      const i = findChunkIndexForOffset(chunks, charOffset);
      if (i < 0 || isChunkCached(docHash, chunks[i].charStart, settings)) return;
      const engine = await ensureEngine();
      if (!engine || token !== playTokenRef.current) return;
      const fs = buildFastStart(text, chunks, charOffset);
      try {
        if (fs) await withEngine(modelId!, (t) => ensureLeadAudio(t, engine.voice, docHash, fs.lead.chunk, settings));
        else await withEngine(modelId!, (t) => ensureChunkAudio(t, engine.voice, docHash, chunks[i], settings));
      } catch {}
    },
    [chunks, text, docHash, settings, modelId, ensureEngine],
  );
  useEffect(() => {
    if (!ready || started || fullyRendered || chunks.length === 0 || !modelId) return;
    const startAt = currentRef.current?.charStart ?? chunks[0].charStart;
    const warmKey = `${docHash}|${settingsHash(settings)}|${startAt}`;
    if (warmedRef.current === warmKey) return;
    warmedRef.current = warmKey;
    void warmStart(startAt);
  }, [ready, current, started, fullyRendered, chunks, modelId, docHash, settings, warmStart]);

  const offsets = useMemo(() => (durTable ? cumulativeOffsetsSec(durTable, speed) : null), [durTable, speed]);
  const tableDurationSec = useMemo(() => (durTable ? totalDurationSec(durTable, speed) : 0), [durTable, speed]);

  // Timestamp of the last rate WE applied. The mirror below ignores the player's
  // rate for a moment afterwards, so our own applications (an in-app speed change,
  // or a new clip resetting to the default rate before we re-apply) don't get
  // read back and fight the user's slider.
  const rateAppliedAtRef = useRef(0);

  // Apply the requested playback speed live (cache is rendered at neutral rate).
  useEffect(() => {
    try {
      player.setPlaybackRate(speed, 'high');
      rateAppliedAtRef.current = Date.now();
    } catch {}
  }, [speed, player]);

  // Mirror a notification-driven speed change (the OS speed button cycles the
  // player's rate directly) back into app state — but not the transient rates we
  // cause ourselves (guarded by rateAppliedAtRef), which was reverting the slider.
  useEffect(() => {
    if (!status.isLoaded || !status.playing) return;
    if (Date.now() - rateAppliedAtRef.current < 1000) return;
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
      // Claim WITHOUT artwork first: a bad artwork uri must never stop the media
      // notification from appearing. Fold artwork in via a non-fatal update after.
      const { artworkUrl, ...meta } = lockMetadataRef.current;
      player.setActiveForLockScreen(true, meta, { ...LOCK_OPTIONS, accentColor, isLiveStream: !singleItem });
      lockScreenActiveRef.current = true;
      if (artworkUrl) {
        try {
          player.updateLockScreenMetadata?.(lockMetadataRef.current);
        } catch {}
      }
    } catch (e) {
      console.warn('[usePlayback] failed to activate lock-screen controls:', e);
    }
  }, [player, accentColor, singleItem]);

  const cancelPendingPlaybackTrace = useCallback(() => {
    if (playbackTraceRef.current == null) return;
    cancelPlaybackTrace(playbackTraceRef.current);
    playbackTraceRef.current = null;
  }, []);

  // Cached audiobook and in-place resume requests bypass playChunkObject, but
  // still need the same tap-to-playing measurement as synthesized clips.
  const beginCachedPlaybackTrace = useCallback(
    (kind: PlaybackRequestKind, decision: PlaybackCacheDecision, chars = 0, alreadyLoaded = false) => {
      cancelPendingPlaybackTrace();
      const traceId = startPlaybackTrace({ kind, chars });
      playbackTraceRef.current = traceId;
      markPlaybackCacheDecision(traceId, decision);
      const readyAt = Date.now();
      markPlaybackPrepared(traceId, readyAt, null);
      markPlaybackPlayerRequested(traceId);
      if (alreadyLoaded) markPlaybackPlayerLoaded(traceId);
    },
    [cancelPendingPlaybackTrace, player],
  );

  // --- Single concatenated-audiobook playback (one media item) ----------------
  // Cumulative NEUTRAL-rate start time (s) of each chunk, mapping a char offset /
  // chunk index to an absolute position in the single audiobook file.
  const neutralStarts = useMemo(() => {
    // Prefer the stitched file's REAL offsets (no cumulative drift); append a
    // synthetic total (last real start + its predicted duration).
    if (!durTable) return null;
    return buildNeutralStarts(durTable, fileStarts);
  }, [fileStarts, durTable]);

  const neutralForOffset = useCallback(
    (charOffset: number): number => {
      if (!neutralStarts) return 0;
      return neutralTimeForOffset(chunks, neutralStarts, charOffset);
    },
    [neutralStarts, chunks],
  );

  const ensureAudiobookLoaded = useCallback(() => {
    if (!audiobookUri) return;
    if (!audiobookLoadedRef.current || loadedKeyRef.current !== AUDIOBOOK_KEY) {
      player.replace(audiobookUri);
      try {
        player.setPlaybackRate(speed, 'high');
        rateAppliedAtRef.current = Date.now();
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
      beginCachedPlaybackTrace(
        'audiobook',
        'audiobook-cache',
        chunks[i].text.length,
        audiobookLoadedRef.current && loadedKeyRef.current === AUDIOBOOK_KEY && player.isLoaded,
      );
      ensureAudiobookLoaded();
      seekNeutralAbs(neutralStarts[i]);
      player.play();
      claimLockScreen();
      setStarted(true);
      setEngaged(true);
    },
    [chunks, neutralStarts, beginCachedPlaybackTrace, ensureAudiobookLoaded, seekNeutralAbs, player, claimLockScreen],
  );

  const playChunkObject = useCallback(
    async (chunk: Chunk, anchorIdx: number, resumeIdx: number, opts?: { lead?: boolean; next?: Lead | null }) => {
      const lead = opts?.lead ?? false;
      const next = opts?.next ?? null;
      cancelPendingPlaybackTrace();
      const traceId = startPlaybackTrace({
        kind: lead ? 'fast-lead' : 'canonical',
        chars: chunk.text.length,
        fastLeadChars: lead ? chunk.text.length : null,
      });
      playbackTraceRef.current = traceId;
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
        markPlaybackCacheDecision(traceId, cached ? (lead ? 'lead-cache' : 'canonical-cache') : (lead ? 'lead-synthesis' : 'canonical-synthesis'));
        let uri: string;
        if (cached) {
          // Cache hit — play instantly, no engine, no spinner.
          uri = lead
            ? leadAudioFile(docHash, chunk.charStart, chunk.text.length, settings).uri
            : chunkAudioUri(docHash, chunk.charStart, settings);
          const readyAt = Date.now();
          markPlaybackPrepared(traceId, readyAt, null);
        } else {
          setLoading(true);
          const preparationStartedAt = Date.now();
          let synthesisMetrics: NarrationSynthesisMetrics | null = null;
          const engine = await ensureEngine();
          if (!engine) {
            failPlaybackTrace(traceId);
            if (playbackTraceRef.current === traceId) playbackTraceRef.current = null;
            if (token === playTokenRef.current) setLoading(false);
            return;
          }
          if (token !== playTokenRef.current) {
            cancelPlaybackTrace(traceId);
            return; // superseded while loading
          }
          uri = lead
            ? await withEngine(modelId!, (tts) => ensureLeadAudio(tts, engine.voice, docHash, chunk, settings, (metrics) => { synthesisMetrics = metrics; }))
            : await withEngine(modelId!, (tts) => ensureChunkAudio(tts, engine.voice, docHash, chunk, settings, (metrics) => { synthesisMetrics = metrics; }));
          markPlaybackPrepared(traceId, preparationStartedAt, synthesisMetrics);
        }
        if (token !== playTokenRef.current) {
          cancelPlaybackTrace(traceId);
          return; // superseded
        }
        player.replace(uri);
        try {
          player.setPlaybackRate(speed, 'high');
          rateAppliedAtRef.current = Date.now();
        } catch {}
        loadedKeyRef.current = chunk.charStart;
        markPlaybackPlayerRequested(traceId);
        player.play();
        claimLockScreen(); // on first audio, so transport appears + background survives
        setLoading(false);
        // Generate-ahead so boundaries don't stall: a queued remainder first (it
        // plays next), then upcoming canonical chunks. Cached items are skipped.
        void (async () => {
          let enginePromise: ReturnType<typeof ensureEngine> | null = null;
          const backgroundEngine = () => {
            enginePromise ??= ensureEngine();
            return enginePromise;
          };
          if (next && !isChunkCached(docHash, next.chunk.charStart, settings)) {
            if (token !== playTokenRef.current) return;
            const engine = await backgroundEngine();
            if (!engine || token !== playTokenRef.current) return;
            try {
              await withEngine(modelId!, (tts) => ensureChunkAudio(tts, engine.voice, docHash, next.chunk, settings));
            } catch {}
            if (token !== playTokenRef.current) return;
          }
          // Depth adapts to how well synthesis is keeping up: deep buffer when
          // ahead of realtime, just the next clip or two when falling behind.
          const synthThroughput = getSynthRtf(modelId);
          const depth = prefetchDepth(synthThroughput);
          recordPrefetchDepth(depth, synthThroughput);
          for (let k = 0; k < depth; k++) {
            if (token !== playTokenRef.current) return;
            const ahead = chunks[resumeIdx + k];
            if (!ahead) return;
            if (isChunkCached(docHash, ahead.charStart, settings)) continue;
            const engine = await backgroundEngine();
            if (!engine || token !== playTokenRef.current) return;
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
              const engine = await backgroundEngine();
              if (engine && token === playTokenRef.current) {
                try {
                  await withEngine(modelId!, (tts) => ensureChunkAudio(tts, engine.voice, docHash, enclosing, settings));
                } catch {}
              }
            }
          }
        })();
      } catch (e) {
        failPlaybackTrace(traceId);
        if (playbackTraceRef.current === traceId) playbackTraceRef.current = null;
        if (token === playTokenRef.current) setLoading(false);
        console.warn('[usePlayback] failed to play chunk at', chunk.charStart, e);
      }
    },
    [chunks, docHash, player, settings, speed, ensureEngine, claimLockScreen, modelId, cancelPendingPlaybackTrace],
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
        const nextWasCached = isChunkCached(docHash, pending.chunk.charStart, settings);
        boundaryGapRef.current = { startedAtMs: Date.now(), nextWasCached };
        if (!nextWasCached) stallStartRef.current = Date.now();
        pendingLeadRef.current = null;
        void playChunkObject(pending.chunk, pending.anchorIdx, pending.resumeIdx);
      } else {
        const next = resumeIndexRef.current;
        if (next < chunks.length) {
          const nextWasCached = isChunkCached(docHash, chunks[next].charStart, settings);
          boundaryGapRef.current = { startedAtMs: Date.now(), nextWasCached };
          if (!nextWasCached) stallStartRef.current = Date.now();
          playCanonical(next);
        } else activeRef.current = false;
      }
    }
    if (!status.didJustFinish) finishedHandledRef.current = false;
  }, [singleItem, status.didJustFinish, chunks.length, playCanonical, playChunkObject, docHash, settings]);

  // Resolve player-side stages for the current production request. This observes
  // the same native status changes that drive the UI, so tap-to-playing includes
  // cache lookup, engine wait, synthesis, encoding, player load, and start.
  useEffect(() => {
    const traceId = playbackTraceRef.current;
    if (traceId != null && status.isLoaded) markPlaybackPlayerLoaded(traceId);
    if (!status.playing) return;
    if (traceId != null) {
      finishPlaybackTrace(traceId);
      playbackTraceRef.current = null;
    }
    const boundary = boundaryGapRef.current;
    if (boundary) {
      recordBoundaryGap(Date.now() - boundary.startedAtMs, boundary.nextWasCached);
      boundaryGapRef.current = null;
    }
  }, [status.isLoaded, status.playing]);

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
      beginCachedPlaybackTrace(
        'audiobook',
        'audiobook-cache',
        currentRef.current?.text.length ?? 0,
        audiobookLoadedRef.current && loadedKeyRef.current === AUDIOBOOK_KEY && player.isLoaded,
      );
      ensureAudiobookLoaded(); // one media item: load once, resume in place

      player.play();
      claimLockScreen();
      setStarted(true);
      return;
    }
    const cur = currentRef.current;
    if (cur && status.isLoaded && loadedKeyRef.current === cur.charStart && !status.playing) {
      beginCachedPlaybackTrace('resume', 'loaded-player', cur.text.length, true);
      player.play(); // resume the current chunk in place
      claimLockScreen(); // a prior halt released the OS controls — bring them back
    } else if (cur) {
      if (!startFast(cur.charStart)) void playChunkObject(cur, anchorIndexRef.current, resumeIndexRef.current);
    } else if (chunks.length) {
      if (!startFast(chunks[0].charStart)) playCanonical(0); // nothing selected → start from the top
    }
  }, [singleItem, beginCachedPlaybackTrace, ensureAudiobookLoaded, playChunkObject, playCanonical, startFast, player, status.isLoaded, status.playing, chunks, claimLockScreen]);

  const pause = useCallback(() => {
    activeRef.current = false;
    playTokenRef.current++; // cancel any in-flight load so it can't auto-start
    cancelPendingPlaybackTrace();
    boundaryGapRef.current = null;
    setLoading(false);
    player.pause();
  }, [player, cancelPendingPlaybackTrace]);

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
        const i = findChunkIndexForOffset(chunks, charOffset);
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
          cancelPendingPlaybackTrace();
          boundaryGapRef.current = null;
          activeRef.current = false;
          player.pause();
        }
        ensureAudiobookLoaded();
        seekNeutralAbs(neutralForOffset(charOffset));
        const i = findChunkIndexForOffset(chunks, charOffset);
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
        cancelPendingPlaybackTrace();
        boundaryGapRef.current = null;
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
    [singleItem, resolveStart, player, ensureAudiobookLoaded, seekNeutralAbs, neutralForOffset, chunks, cancelPendingPlaybackTrace],
  );

  const select = useCallback((charOffset: number) => setSelection(charOffset, true), [setSelection]);
  const goTo = useCallback((charOffset: number) => setSelection(charOffset, false), [setSelection]);

  const playFrom = useCallback(
    (charOffset: number) => {
      if (singleItem) {
        activeRef.current = true;
        beginCachedPlaybackTrace(
          'audiobook',
          'audiobook-cache',
          currentRef.current?.text.length ?? 0,
          audiobookLoadedRef.current && loadedKeyRef.current === AUDIOBOOK_KEY && player.isLoaded,
        );
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
    [singleItem, beginCachedPlaybackTrace, ensureAudiobookLoaded, seekNeutralAbs, neutralForOffset, player, claimLockScreen, startFast, resolveStart, playChunkObject],
  );

  // Hard stop (the "Stop" action): halt audio, drop the selection, release the OS
  // controls so nothing lingers in the notification.
  const stop = useCallback(() => {
    playTokenRef.current++;
    cancelPendingPlaybackTrace();
    boundaryGapRef.current = null;
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
  }, [player, cancelPendingPlaybackTrace]);

  // Soft stop (mini-player's square): halt audio + release the notification, but
  // KEEP selection/position/`started` so play resumes in place.
  const halt = useCallback(() => {
    playTokenRef.current++; // cancel any in-flight load so it can't auto-start
    cancelPendingPlaybackTrace();
    boundaryGapRef.current = null;
    activeRef.current = false;
    setLoading(false);
    player.pause();
    try {
      playerRef.current?.clearLockScreenControls?.();
    } catch {}
    lockScreenActiveRef.current = false;
  }, [player, cancelPendingPlaybackTrace]);

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
        beginCachedPlaybackTrace(
          'audiobook',
          'audiobook-cache',
          currentRef.current?.text.length ?? 0,
          audiobookLoadedRef.current && loadedKeyRef.current === AUDIOBOOK_KEY && player.isLoaded,
        );
        ensureAudiobookLoaded();
        seekNeutralAbs(sec * speed);
        player.play();
        claimLockScreen();
        setStarted(true);
        setEngaged(true);
        return;
      }
      const loc = locateTime(durTable, speed, sec, offsets ?? undefined);
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
    [durTable, offsets, singleItem, beginCachedPlaybackTrace, ensureAudiobookLoaded, seekNeutralAbs, speed, player, claimLockScreen, playCanonical, startFast, chunks],
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
