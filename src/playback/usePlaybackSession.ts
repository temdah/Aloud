import { createAudioPlayer, useAudioPlayerStatus, type AudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audiobookAudioUri, buildTimeline, cumulativeOffsetsSec, findChunkIndexForOffset, getEngine, isAudiobookCached, getSynthRtf, isChunkCached, isSentenceCached, locateTime, ModelLoadError, readAudiobookIndex, sentenceSettingsHash, settingsHash, totalDurationSec } from '../supertonic';
import type { DurationTable, NarrationSettings } from '../supertonic';
import {
  buildFastStart,
  buildLead,
  buildNeutralStarts,
  calculateDocumentPosition,
  cancelPlaybackTrace,
  charOffsetForTime,
  failPlaybackTrace,
  finishPlaybackTrace,
  findChunkIndexAtTime,
  markPlaybackCacheDecision,
  markPlaybackPlayerLoaded,
  markPlaybackPlayerRequested,
  markPlaybackPrepared,
  neutralTimeForOffset,
  PlaybackRecoveryController,
  PlaybackRequestGate,
  PlaybackPrefetcher,
  PlaybackPlayerController,
  PlaybackPreparation,
  PlaybackSynthesizer,
  recordBoundaryGap,
  sentenceTargetAtIndex,
  sentenceTargetForStart,
  startPlaybackTrace,
  usePlaybackMediaSession,
  type Lead,
  type Playback,
  type PlaybackCacheDecision,
  type PlaybackRequestKind,
  type RecoverableClip,
  type UsePlaybackOptions,
} from './core';
import { useDocumentsStore, useSettingsStore } from '../stores';
import { useTheme } from '../theme';
import type { Chunk } from '../types';
// loadedKeyRef sentinel for "the concatenated audiobook file is loaded" (vs a
// per-chunk charStart >= 0; -1 means nothing loaded).
const AUDIOBOOK_KEY = -2;

// Perf-tip detection thresholds.
const STALL_MS = 2000; // a boundary gap longer than this = an audible stall
const STALL_TRIGGER = 2; // stalls in a session before offering the tip
const RTF_THRESHOLD = 1.1; // synthesis realtime factor below which we blame the device

// Sequential, cached, generate-ahead playback. Stable sentence units are the
// normal path; canonical chunks and partial leads remain for mid-sentence starts
// and full-audiobook compatibility.
export function usePlaybackSession({ docHash, plan, modelId, voiceId, speed, steps, lang = 'en', quality, tone, title, artist, onSpeedChange }: UsePlaybackOptions): Playback {
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
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [recoverySignal, setRecoverySignal] = useState(0);
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
  // Explicit request ownership prevents stale synthesis and prefetch work from
  // taking control of the player after pause, seek, or a newer play request.
  const requestGateRef = useRef<PlaybackRequestGate | null>(null);
  requestGateRef.current ??= new PlaybackRequestGate();
  const requestGate = requestGateRef.current;
  // Latest production playback request being measured. The metrics buffer is
  // module-scoped so the developer lab can inspect it after leaving the reader.
  const playbackTraceRef = useRef<number | null>(null);
  const boundaryGapRef = useRef<{ startedAtMs: number; nextWasCached: boolean } | null>(null);
  const currentRef = useRef<Chunk | null>(null);
  const anchorIndexRef = useRef(0); // canonical index the current chunk starts in
  const resumeIndexRef = useRef(0); // canonical index to play after the current chunk
  const activeSequenceRef = useRef<'canonical' | 'sentence'>('canonical');
  const sentenceIndexRef = useRef(-1);
  // A "remainder" clip queued to play right after the current fast-lead clip
  // finishes, before resuming canonical chunks. Cleared once consumed.
  const pendingLeadRef = useRef<Lead | null>(null);
  // A neutral-rate seek (seconds) to apply once the next clip finishes loading,
  // set by seekToTime so a timeline scrub lands precisely inside its chunk.
  const pendingSeekRef = useRef<number | null>(null);
  const loadedKeyRef = useRef(-1); // charStart of the audio currently in the player
  const loadedSequenceRef = useRef<'none' | 'canonical' | 'sentence' | 'audiobook'>('none');
  const loadedClipRef = useRef<RecoverableClip | null>(null);
  const recoveryRef = useRef<PlaybackRecoveryController | null>(null);
  recoveryRef.current ??= new PlaybackRecoveryController();
  const recovery = recoveryRef.current;
  const handledPlayerErrorRef = useRef<string | null>(null);
  const handledRecoverySignalRef = useRef(0);

  const settings = useMemo<NarrationSettings>(
    () => ({ modelId: modelId ?? '', voiceId, speed, steps, lang, quality, tone }),
    [modelId, voiceId, speed, steps, lang, quality, tone],
  );
  const synthesizer = useMemo(
    () => modelId ? new PlaybackSynthesizer({ docHash, documentText: text, settings }) : null,
    [docHash, text, modelId, settings],
  );
  const prefetcher = useMemo(
    () => synthesizer ? new PlaybackPrefetcher({ docHash, settings, synthesizer }) : null,
    [docHash, settings, synthesizer],
  );
  const preparation = useMemo(
    () => synthesizer ? new PlaybackPreparation({ docHash, settings, synthesizer }) : null,
    [docHash, settings, synthesizer],
  );
  // Timeline durations are neutral-rate and their cache ignores speed. Keep a
  // stable settings object so moving the speed control never probes every chunk.
  const timelineSettings = useMemo<NarrationSettings>(
    () => ({ modelId: modelId ?? '', voiceId, speed: 1, steps, lang, quality, tone }),
    [modelId, voiceId, steps, lang, quality, tone],
  );

  // A full audiobook rendered with these exact settings: play straight from cache
  // (no cold-load) and snap starts to chunk boundaries so every clip is a hit.
  const audiobook = useDocumentsStore((s) => s.audiobook[docHash]);
  const fullyRendered = useMemo(
    () => !!modelId && audiobook?.status === 'done' && audiobook.profileHash === settingsHash(settings),
    [modelId, audiobook?.status, audiobook?.profileHash, settings],
  );
  const [audiobookFailed, setAudiobookFailed] = useState(false);
  const keepEngineWarm = useSettingsStore((s) => s.keepEngineWarm);
  useEffect(() => setAudiobookFailed(false), [docHash, settings]);

  // When a full render is stitched into one file, play it as ONE media item so
  // the OS notification gets a real whole-book timeline + scrubber. Null if the
  // file isn't there (concat failed / still per-chunk) → normal per-chunk path.
  const audiobookUri = useMemo(
    () => (!audiobookFailed && fullyRendered && isAudiobookCached(docHash, settings) ? audiobookAudioUri(docHash, settings) : null),
    [audiobookFailed, fullyRendered, docHash, settings],
  );
  const singleItem = audiobookUri != null;
  const syncExternalSpeed = useCallback(
    (nextSpeed: number) => {
      if (onSpeedChange) onSpeedChange(nextSpeed);
      else useSettingsStore.getState().setSpeed(nextSpeed);
    },
    [onSpeedChange],
  );
  const { claimLockScreen, releaseLockScreen, applyPlaybackRate } = usePlaybackMediaSession({
    player,
    title,
    artist,
    accentColor,
    singleItem,
    speed,
    isLoaded: status.isLoaded,
    playing: status.playing,
    reportedRate: status.playbackRate,
    onExternalSpeedChange: syncExternalSpeed,
  });
  const playerControl = useMemo(
    () => new PlaybackPlayerController(player, applyPlaybackRate),
    [player, applyPlaybackRate],
  );
  const audiobookLoadedRef = useRef(false);
  // Real per-chunk offsets (s) in the stitched file from the index sidecar — the
  // file's actual clock. Null → fall back to predicted starts.
  const [fileStarts, setFileStarts] = useState<number[] | null>(null);
  useEffect(() => {
    audiobookLoadedRef.current = false; // a new/absent audiobook file must be (re)loaded
    setFileStarts(audiobookUri ? readAudiobookIndex(docHash, settings) : null);
  }, [audiobookUri, docHash, settings]);

  // The player outlives any single screen, so switching to a *different* document
  // stops the old one and clears state; reopening the SAME doc leaves it running.
  const prevDocRef = useRef(docHash);
  useEffect(() => {
    if (prevDocRef.current === docHash) return;
    prevDocRef.current = docHash;
    if (playbackTraceRef.current != null) cancelPlaybackTrace(playbackTraceRef.current);
    playbackTraceRef.current = null;
    boundaryGapRef.current = null;
    requestGate.cancel();
    activeRef.current = false;
    finishedHandledRef.current = false;
    playerControl.pause();
    setEngaged(false);
    setStarted(false);
    setCurrent(null);
    currentRef.current = null;
    loadedKeyRef.current = -1;
    loadedSequenceRef.current = 'none';
    loadedClipRef.current = null;
    recovery.clear();
    handledPlayerErrorRef.current = null;
    handledRecoverySignalRef.current = recoverySignal;
    setPlaybackError(null);
    anchorIndexRef.current = 0;
    resumeIndexRef.current = 0;
    activeSequenceRef.current = 'canonical';
    sentenceIndexRef.current = -1;
    pendingLeadRef.current = null;
    pendingSeekRef.current = null;
    audiobookLoadedRef.current = false;
    releaseLockScreen();
  }, [docHash, playerControl, recovery, requestGate, recoverySignal, releaseLockScreen]);

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
    if (!keepEngineWarm) {
      setReady(true);
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
  }, [modelId, fullyRendered, keepEngineWarm]);

  // Whole-document timeline for the scrubber. Built instantly with no engine —
  // real cached clip lengths where we have them, a char estimate for the rest —
  // so it never delays playback or competes with the clip the user is waiting on.
  useEffect(() => {
    setDurTable(chunks.length === 0 ? null : buildTimeline(docHash, chunks, timelineSettings));
  }, [docHash, chunks, timelineSettings]);

  // Warm the stable sentence (or legacy fallback clip) the user will hear first
  // while the engine is idle. Dedup means play attaches to the same synthesis.
  const warmedRef = useRef<string | null>(null);
  const warmStart = useCallback(
    async (charOffset: number) => {
      const token = requestGate.current();
      const sentence = sentenceTargetForStart(plan, charOffset);
      if (sentence) {
        if (!synthesizer || isSentenceCached(docHash, sentence.anchor, settings)) return;
        try {
          await synthesizer.prepareSentence(sentence.anchor, {
            priority: 'background',
            shouldContinue: () => requestGate.isCurrent(token),
          });
        } catch {}
        return;
      }
      const i = findChunkIndexForOffset(chunks, charOffset);
      if (!synthesizer || i < 0 || isChunkCached(docHash, chunks[i].charStart, settings)) return;
      const fs = buildFastStart(text, chunks, charOffset);
      try {
        await synthesizer.prepareChunk(fs?.lead.chunk ?? chunks[i], fs ? 'lead' : 'canonical', {
          priority: 'background',
          shouldContinue: () => requestGate.isCurrent(token),
        });
      } catch {}
    },
    [plan, chunks, text, docHash, settings, synthesizer, requestGate],
  );
  useEffect(() => {
    if (!keepEngineWarm || !ready || started || fullyRendered || chunks.length === 0 || !modelId) return;
    const startAt = currentRef.current?.charStart ?? chunks[0].charStart;
    const sentence = sentenceTargetForStart(plan, startAt);
    const warmKey = sentence
      ? `${docHash}|${sentenceSettingsHash(settings)}|${sentence.anchor.id}`
      : `${docHash}|${settingsHash(settings)}|${startAt}`;
    if (warmedRef.current === warmKey) return;
    warmedRef.current = warmKey;
    void warmStart(startAt);
  }, [keepEngineWarm, ready, current, started, fullyRendered, chunks, modelId, docHash, settings, plan, warmStart]);

  const offsets = useMemo(() => (durTable ? cumulativeOffsetsSec(durTable, speed) : null), [durTable, speed]);
  const tableDurationSec = useMemo(() => (durTable ? totalDurationSec(durTable, speed) : 0), [durTable, speed]);

  // Apply a queued timeline seek once the freshly-loaded clip reports a duration.
  useEffect(() => {
    if (pendingSeekRef.current == null) return;
    if (!status.isLoaded || status.duration <= 0) return;
    const target = pendingSeekRef.current;
    pendingSeekRef.current = null;
    playerControl.seekTo(Math.min(status.duration, target));
  }, [status.isLoaded, status.duration, playerControl]);

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
    setPlaybackError(null);
    if (!audiobookLoadedRef.current || loadedKeyRef.current !== AUDIOBOOK_KEY) {
      loadedClipRef.current = { kind: 'audiobook', key: `audiobook:${docHash}:${settingsHash(settings)}` };
      playerControl.load(audiobookUri);
      audiobookLoadedRef.current = true;
      loadedKeyRef.current = AUDIOBOOK_KEY;
      loadedSequenceRef.current = 'audiobook';
    }
  }, [audiobookUri, docHash, playerControl, settings]);

  // Seek the single audiobook file to a neutral-rate absolute time. If it isn't
  // loaded/measured yet, defer via pendingSeekRef (applied by the effect above).
  const seekNeutralAbs = useCallback(
    (neutralSec: number) => {
      if (status.isLoaded && status.duration > 0 && loadedKeyRef.current === AUDIOBOOK_KEY) {
        playerControl.seekTo(Math.min(status.duration, neutralSec));
        pendingSeekRef.current = null;
      } else {
        pendingSeekRef.current = neutralSec;
      }
    },
    [playerControl, status.isLoaded, status.duration],
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
      playerControl.play();
      claimLockScreen();
      setStarted(true);
      setEngaged(true);
    },
    [chunks, neutralStarts, beginCachedPlaybackTrace, ensureAudiobookLoaded, seekNeutralAbs, player, playerControl, claimLockScreen],
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
      const token = requestGate.begin();
      setPlaybackError(null);
      activeRef.current = true;
      currentRef.current = chunk;
      activeSequenceRef.current = 'canonical';
      sentenceIndexRef.current = -1;
      anchorIndexRef.current = anchorIdx;
      resumeIndexRef.current = resumeIdx;
      // Queue the remainder (if any) to play when this clip finishes.
      pendingLeadRef.current = next;
      loadedClipRef.current = {
        kind: 'canonical',
        key: `${lead ? 'lead' : 'chunk'}:${docHash}:${chunk.charStart}:${chunk.text.length}:${settingsHash(settings)}`,
        chunk,
        anchorIdx,
        resumeIdx,
        lead,
        next,
      };
      setCurrent(chunk);
      setEngaged(true);
      setStarted(true); // audio is now actually engaged → MiniPlayer may show
      playerControl.pause();
      try {
        if (!preparation) {
          failPlaybackTrace(traceId);
          if (playbackTraceRef.current === traceId) playbackTraceRef.current = null;
          setLoading(false);
          return;
        }
        const prepared = await preparation.prepareChunk(chunk, lead ? 'lead' : 'canonical', {
          shouldContinue: () => requestGate.isCurrent(token),
          onDecision: (decision, cached) => {
            markPlaybackCacheDecision(traceId, decision);
            if (!cached) setLoading(true);
          },
        });
        if (!prepared) {
          cancelPlaybackTrace(traceId);
          return;
        }
        markPlaybackPrepared(traceId, prepared.preparationStartedAt, prepared.metrics);
        if (!requestGate.isCurrent(token)) {
          cancelPlaybackTrace(traceId);
          return; // superseded
        }
        playerControl.load(prepared.uri);
        loadedKeyRef.current = chunk.charStart;
        loadedSequenceRef.current = 'canonical';
        markPlaybackPlayerRequested(traceId);
        playerControl.play();
        claimLockScreen(); // on first audio, so transport appears + background survives
        setLoading(false);
        void prefetcher?.prefetchCanonical({
          chunks,
          startIndex: resumeIdx,
          immediate: next?.chunk,
          enclosing: lead ? chunks[anchorIdx] : null,
          shouldContinue: () => requestGate.isCurrent(token),
        });
      } catch (e) {
        failPlaybackTrace(traceId);
        if (playbackTraceRef.current === traceId) playbackTraceRef.current = null;
        if (requestGate.isCurrent(token)) {
          setLoading(false);
          setPlaybackError('This section could not be prepared for playback.');
          setRecoverySignal((value) => value + 1);
        }
        console.warn('[usePlayback] failed to play chunk at', chunk.charStart, e);
      }
    },
    [chunks, docHash, playerControl, settings, speed, preparation, prefetcher, claimLockScreen, cancelPendingPlaybackTrace, requestGate],
  );

  const playSentence = useCallback(
    async (sentenceIndex: number) => {
      const target = sentenceTargetAtIndex(plan, sentenceIndex);
      if (!target) return;
      cancelPendingPlaybackTrace();
      const traceId = startPlaybackTrace({ kind: 'sentence', chars: target.chunk.text.length });
      playbackTraceRef.current = traceId;
      const token = requestGate.begin();
      setPlaybackError(null);
      activeRef.current = true;
      activeSequenceRef.current = 'sentence';
      sentenceIndexRef.current = sentenceIndex;
      currentRef.current = target.chunk;
      anchorIndexRef.current = target.canonicalIndex;
      resumeIndexRef.current = target.nextCanonicalIndex;
      pendingLeadRef.current = null;
      loadedClipRef.current = {
        kind: 'sentence',
        key: `sentence:${docHash}:${target.anchor.id}:${sentenceSettingsHash(settings)}`,
        sentenceIndex,
      };
      setCurrent(target.chunk);
      setEngaged(true);
      setStarted(true);
      playerControl.pause();

      try {
        if (!preparation) {
          failPlaybackTrace(traceId);
          if (playbackTraceRef.current === traceId) playbackTraceRef.current = null;
          setLoading(false);
          return;
        }
        const prepared = await preparation.prepareSentence(target.anchor, {
          shouldContinue: () => requestGate.isCurrent(token),
          onDecision: (decision, cached) => {
            markPlaybackCacheDecision(traceId, decision);
            if (!cached) setLoading(true);
          },
        });
        if (!prepared) {
          cancelPlaybackTrace(traceId);
          return;
        }
        markPlaybackPrepared(traceId, prepared.preparationStartedAt, prepared.metrics);
        if (!requestGate.isCurrent(token)) {
          cancelPlaybackTrace(traceId);
          return;
        }
        playerControl.load(prepared.uri);
        loadedKeyRef.current = target.chunk.charStart;
        loadedSequenceRef.current = 'sentence';
        markPlaybackPlayerRequested(traceId);
        playerControl.play();
        claimLockScreen();
        setLoading(false);

        void prefetcher?.prefetchSentences({
          plan,
          startIndex: sentenceIndex + 1,
          shouldContinue: () => requestGate.isCurrent(token),
        });
      } catch (error) {
        failPlaybackTrace(traceId);
        if (playbackTraceRef.current === traceId) playbackTraceRef.current = null;
        if (requestGate.isCurrent(token)) {
          setLoading(false);
          setPlaybackError('This sentence could not be prepared for playback.');
          setRecoverySignal((value) => value + 1);
        }
        console.warn('[usePlayback] failed to play sentence at', target.anchor.charStart, error);
      }
    },
    [plan, cancelPendingPlaybackTrace, docHash, settings, playerControl, preparation, prefetcher, speed, claimLockScreen, requestGate],
  );

  const playCanonical = useCallback(
    (i: number) => {
      if (i < 0 || i >= chunks.length) return;
      void playChunkObject(chunks[i], i, i + 1);
    },
    [chunks, playChunkObject],
  );

  const recoverLoadedClip = useCallback(
    (userInitiated = false) => {
      const action = recovery.recover(loadedClipRef.current, {
        docHash,
        plan,
        chunks,
        settings,
        currentChunkIndex: anchorIndexRef.current,
      }, userInitiated);
      if (action.kind === 'missing' || action.kind === 'exhausted') {
        if (action.kind === 'exhausted') {
          activeRef.current = false;
          setLoading(false);
          playerControl.pause();
        }
        setPlaybackError(action.message);
        return;
      }

      requestGate.cancel();
      playerControl.pause();
      setLoading(false);
      setPlaybackError(null);
      if (action.kind === 'sentence') {
        void playSentence(action.sentenceIndex);
        return;
      }
      if (action.kind === 'canonical') {
        const clip = action.clip;
        void playChunkObject(clip.chunk, clip.anchorIdx, clip.resumeIdx, {
          lead: clip.lead,
          next: clip.next,
        });
        return;
      }

      setAudiobookFailed(true);
      audiobookLoadedRef.current = false;
      loadedKeyRef.current = -1;
      loadedSequenceRef.current = 'none';
      if (action.fallbackIndex == null) {
        setPlaybackError('The audiobook is empty and cannot be played.');
        return;
      }
      const chunk = chunks[action.fallbackIndex];
      if (chunk) void playChunkObject(chunk, action.fallbackIndex, action.fallbackIndex + 1);
    },
    [chunks, docHash, plan, playChunkObject, playSentence, playerControl, recovery, requestGate, settings],
  );

  // Native decode/load failures arrive asynchronously through player status.
  // Handle each error transition once: invalidate its cache identity and rebuild
  // the clip, but never enter an automatic retry loop.
  useEffect(() => {
    if (!status.error) {
      handledPlayerErrorRef.current = null;
      return;
    }
    const errorKey = `${loadedClipRef.current?.key ?? 'unknown'}:${status.error}`;
    if (handledPlayerErrorRef.current === errorKey) return;
    handledPlayerErrorRef.current = errorKey;
    recoverLoadedClip(false);
  }, [status.error, recoverLoadedClip]);

  useEffect(() => {
    if (recoverySignal === 0 || handledRecoverySignalRef.current === recoverySignal) return;
    handledRecoverySignalRef.current = recoverySignal;
    recoverLoadedClip(false);
  }, [recoverySignal, recoverLoadedClip]);

  const retry = useCallback(() => recoverLoadedClip(true), [recoverLoadedClip]);

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
      if (activeSequenceRef.current === 'sentence') {
        const nextSentence = sentenceTargetAtIndex(plan, sentenceIndexRef.current + 1);
        if (nextSentence) {
          const nextWasCached = isSentenceCached(docHash, nextSentence.anchor, settings);
          boundaryGapRef.current = { startedAtMs: Date.now(), nextWasCached };
          if (!nextWasCached) stallStartRef.current = Date.now();
          void playSentence(nextSentence.sentenceIndex);
        } else {
          activeRef.current = false;
        }
        return;
      }
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
  }, [singleItem, status.didJustFinish, chunks.length, plan, playSentence, playCanonical, playChunkObject, docHash, settings]);

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
    const idx = findChunkIndexAtTime(neutralStarts, status.currentTime, chunks.length);
    if (chunks[idx] && currentRef.current !== chunks[idx]) {
      currentRef.current = chunks[idx];
      anchorIndexRef.current = idx;
      setCurrent(chunks[idx]);
    }
  }, [singleItem, neutralStarts, status.currentTime, status.isLoaded, chunks]);

  const startSentence = useCallback(
    (charOffset: number): boolean => {
      if (fullyRendered) return false;
      const target = sentenceTargetForStart(plan, charOffset);
      if (!target) return false;
      void playSentence(target.sentenceIndex);
      return true;
    },
    [fullyRendered, plan, playSentence],
  );

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

      playerControl.play();
      claimLockScreen();
      setStarted(true);
      return;
    }
    const cur = currentRef.current;
    if (
      cur &&
      status.isLoaded &&
      loadedKeyRef.current === cur.charStart &&
      loadedSequenceRef.current === activeSequenceRef.current &&
      !status.playing
    ) {
      beginCachedPlaybackTrace('resume', 'loaded-player', cur.text.length, true);
      playerControl.play();
      claimLockScreen(); // a prior halt released the OS controls — bring them back
    } else if (cur) {
      if (activeSequenceRef.current === 'sentence' && sentenceIndexRef.current >= 0) {
        void playSentence(sentenceIndexRef.current);
      } else if (!startSentence(cur.charStart) && !startFast(cur.charStart)) {
        void playChunkObject(cur, anchorIndexRef.current, resumeIndexRef.current);
      }
    } else if (chunks.length) {
      if (!startSentence(chunks[0].charStart) && !startFast(chunks[0].charStart)) playCanonical(0);
    }
  }, [singleItem, beginCachedPlaybackTrace, ensureAudiobookLoaded, playSentence, startSentence, playChunkObject, playCanonical, startFast, player, playerControl, status.isLoaded, status.playing, chunks, claimLockScreen]);

  const pause = useCallback(() => {
    activeRef.current = false;
    requestGate.cancel(); // cancel any in-flight load so it can't auto-start
    cancelPendingPlaybackTrace();
    boundaryGapRef.current = null;
    setLoading(false);
    playerControl.pause();
  }, [playerControl, cancelPendingPlaybackTrace, requestGate]);

  const toggle = useCallback(() => {
    if (status.playing) pause();
    else play();
  }, [status.playing, play, pause]);

  const playCanonicalStart = useCallback((index: number) => {
    const chunk = chunks[index];
    if (!chunk) return;
    if (!startSentence(chunk.charStart)) playCanonical(index);
  }, [chunks, startSentence, playCanonical]);

  const next = useCallback(() => {
    if (singleItem) return seekToChunkSingle(anchorIndexRef.current + 1);
    playCanonicalStart(resumeIndexRef.current);
  }, [singleItem, seekToChunkSingle, playCanonicalStart]);
  const previous = useCallback(() => {
    if (singleItem) return seekToChunkSingle(Math.max(0, anchorIndexRef.current - 1));
    playCanonicalStart(Math.max(0, anchorIndexRef.current - 1));
  }, [singleItem, seekToChunkSingle, playCanonicalStart]);
  const seekToChunk = useCallback(
    (i: number) => {
      if (singleItem) return seekToChunkSingle(i);
      playCanonicalStart(i);
    },
    [singleItem, seekToChunkSingle, playCanonicalStart],
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
          playerControl.pause();
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
      const sentence = sentenceTargetForStart(plan, charOffset);
      const lead = sentence ? null : resolveStart(charOffset);
      if (!sentence && !lead) return;
      if (stopCurrent) {
    requestGate.cancel();
        cancelPendingPlaybackTrace();
        boundaryGapRef.current = null;
        activeRef.current = false;
        pendingLeadRef.current = null;
        pendingSeekRef.current = null;
        setLoading(false);
        playerControl.pause();
      }
      if (sentence) {
        activeSequenceRef.current = 'sentence';
        sentenceIndexRef.current = sentence.sentenceIndex;
        currentRef.current = sentence.chunk;
        anchorIndexRef.current = sentence.canonicalIndex;
        resumeIndexRef.current = sentence.nextCanonicalIndex;
        setCurrent(sentence.chunk);
      } else if (lead) {
        activeSequenceRef.current = 'canonical';
        sentenceIndexRef.current = -1;
        currentRef.current = lead.chunk;
        anchorIndexRef.current = lead.anchorIdx;
        resumeIndexRef.current = lead.resumeIdx;
        setCurrent(lead.chunk);
      }
      setEngaged(true);
    },
    [singleItem, plan, resolveStart, playerControl, ensureAudiobookLoaded, seekNeutralAbs, neutralForOffset, chunks, cancelPendingPlaybackTrace, requestGate],
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
        playerControl.play();
        claimLockScreen();
        setStarted(true);
        setEngaged(true);
        return;
      }
      if (startSentence(charOffset)) return;
      if (startFast(charOffset)) return;
      const lead = resolveStart(charOffset);
      if (lead) void playChunkObject(lead.chunk, lead.anchorIdx, lead.resumeIdx);
    },
    [singleItem, beginCachedPlaybackTrace, ensureAudiobookLoaded, seekNeutralAbs, neutralForOffset, player, playerControl, claimLockScreen, startSentence, startFast, resolveStart, playChunkObject],
  );

  // Hard stop (the "Stop" action): halt audio, drop the selection, release the OS
  // controls so nothing lingers in the notification.
  const stop = useCallback(() => {
    requestGate.cancel();
    cancelPendingPlaybackTrace();
    boundaryGapRef.current = null;
    activeRef.current = false;
    finishedHandledRef.current = false;
    setLoading(false);
    playerControl.pause();
    playerControl.seekTo(0);
    setEngaged(false);
    setStarted(false);
    setCurrent(null);
    currentRef.current = null;
    loadedKeyRef.current = -1;
    loadedSequenceRef.current = 'none';
    loadedClipRef.current = null;
    recovery.clear();
    handledPlayerErrorRef.current = null;
    setPlaybackError(null);
    activeSequenceRef.current = 'canonical';
    sentenceIndexRef.current = -1;
    pendingLeadRef.current = null;
    pendingSeekRef.current = null;
    releaseLockScreen();
  }, [playerControl, cancelPendingPlaybackTrace, recovery, requestGate, releaseLockScreen]);

  // Soft stop (mini-player's square): halt audio + release the notification, but
  // KEEP selection/position/`started` so play resumes in place.
  const halt = useCallback(() => {
    requestGate.cancel(); // cancel any in-flight load so it can't auto-start
    cancelPendingPlaybackTrace();
    boundaryGapRef.current = null;
    activeRef.current = false;
    setLoading(false);
    playerControl.pause();
    releaseLockScreen();
  }, [playerControl, cancelPendingPlaybackTrace, requestGate, releaseLockScreen]);

  const seek = useCallback(
    (fraction: number) => {
      playerControl.seekFraction(fraction, status.duration, status.isLoaded);
    },
    [playerControl, status.isLoaded, status.duration],
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
        playerControl.play();
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
      const charOffset = c ? charOffsetForTime(c, durTable[loc.index], loc.withinNeutralSec) : 0;
      if (c && startSentence(charOffset)) return;
      if (!c || !startFast(charOffset)) {
        pendingLeadRef.current = null;
        pendingSeekRef.current = loc.withinNeutralSec;
        playCanonical(loc.index);
      }
    },
    [durTable, offsets, singleItem, beginCachedPlaybackTrace, ensureAudiobookLoaded, seekNeutralAbs, speed, player, claimLockScreen, playCanonical, startSentence, startFast, chunks],
  );

  const { positionSec: docPositionSec, durationSec: docDurationSec } = calculateDocumentPosition({
    singleItem,
    isLoaded: status.isLoaded,
    currentTime: status.currentTime,
    mediaDuration: status.duration,
    speed,
    tableDuration: tableDurationSec,
    offsets,
    durations: durTable,
    anchorIndex: anchorIndexRef.current,
    chunks,
    currentChunk: currentRef.current,
  });

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
    error: playbackError,
    retry,
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
