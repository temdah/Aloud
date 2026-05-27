import { createAudioPlayer, setAudioModeAsync, useAudioPlayerStatus, type AudioPlayer } from 'expo-audio';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ensureChunkAudio, loadTextToSpeech, loadVoiceStyle } from '../supertonic';
import type { NarrationSettings, TextToSpeech, VoiceStyle } from '../supertonic';
import type { Chunk } from '../types';
import { stableHash } from '../utils';

// How many upcoming chunks to pre-synthesize so playback doesn't stall at a
// boundary while the next chunk is still being generated.
const PREFETCH_AHEAD = 4;
// Minimum length (chars) of a mid-chunk "lead" so the first clip isn't a tiny
// stutter; a shorter remainder merges forward into the next chunk(s).
const MIN_LEAD = 140;

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
};

export type Playback = {
  ready: boolean;
  playing: boolean;
  /** True while the current chunk's audio is being synthesized (no audio yet). */
  loading: boolean;
  /** True once a chunk is selected or playback has started (drives highlight). */
  engaged: boolean;
  /** The chunk currently playing/selected (a canonical chunk or a tap-start lead). */
  currentChunk: Chunk | null;
  total: number;
  positionSec: number;
  durationSec: number;
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
};

// Sequential, cached, generate-ahead playback. Chunks are large (smooth audio);
// tapping starts at the exact tapped sentence via a one-off "lead" chunk, then
// continues with the canonical chunks after it. Highlight is chunk-level.
export function usePlayback({ docHash, chunks, text, modelId, voiceId, speed, steps, lang = 'en' }: UsePlaybackOptions): Playback {
  // A player we own for the hook's lifetime (created once, released on unmount):
  // useAudioPlayer() released the native player mid-session (replace() failed
  // with ERR_USING_RELEASED_SHARED_OBJECT).
  const playerRef = useRef<AudioPlayer | null>(null);
  if (!playerRef.current) playerRef.current = createAudioPlayer();
  const player = playerRef.current;
  const status = useAudioPlayerStatus(player);

  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [engaged, setEngaged] = useState(false);
  const [current, setCurrent] = useState<Chunk | null>(null);

  const engineRef = useRef<{ tts: TextToSpeech; voice: VoiceStyle } | null>(null);
  const activeRef = useRef(false);
  const finishedHandledRef = useRef(false);
  // Bumped by every new play/select/pause so a slow in-flight synthesis can tell
  // it was superseded and must not grab the player.
  const playTokenRef = useRef(0);
  const currentRef = useRef<Chunk | null>(null);
  const anchorIndexRef = useRef(0); // canonical index the current chunk starts in
  const resumeIndexRef = useRef(0); // canonical index to play after the current chunk
  const loadedKeyRef = useRef(-1); // charStart of the audio currently in the player

  const settings = useMemo<NarrationSettings>(
    () => ({ modelId: modelId ?? '', voiceId, speed, steps, lang }),
    [modelId, voiceId, speed, steps, lang],
  );

  useEffect(() => {
    return () => {
      try {
        playerRef.current?.remove?.();
      } catch {}
      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    engineRef.current = null;
    if (!modelId) return; // no model picked yet — leave the engine unloaded
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
  }, [modelId, voiceId]);

  const playChunkObject = useCallback(
    async (chunk: Chunk, anchorIdx: number, resumeIdx: number) => {
      const engine = engineRef.current;
      if (!engine) return;
      const token = ++playTokenRef.current;
      activeRef.current = true;
      currentRef.current = chunk;
      anchorIndexRef.current = anchorIdx;
      resumeIndexRef.current = resumeIdx;
      setCurrent(chunk);
      setEngaged(true);
      setLoading(true);
      // Stop whatever is playing right now so it doesn't keep going while the
      // newly requested chunk synthesizes (e.g. after "play from here").
      player.pause();
      try {
        const uri = await ensureChunkAudio(engine.tts, engine.voice, docHash, chunk, settings);
        if (token !== playTokenRef.current) return; // superseded
        await setAudioModeAsync({ playsInSilentMode: true });
        if (token !== playTokenRef.current) return;
        player.replace(uri);
        loadedKeyRef.current = chunk.charStart;
        player.play();
        setLoading(false);
        // Generate-ahead from the next canonical chunk so boundaries don't stall.
        void (async () => {
          for (let k = 0; k < PREFETCH_AHEAD; k++) {
            if (token !== playTokenRef.current) return;
            const ahead = chunks[resumeIdx + k];
            if (!ahead) return;
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
    [chunks, docHash, player, settings],
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
      const next = resumeIndexRef.current;
      if (activeRef.current && next < chunks.length) playCanonical(next);
      else activeRef.current = false;
    }
    if (!status.didJustFinish) finishedHandledRef.current = false;
  }, [status.didJustFinish, chunks.length, playCanonical]);

  const play = useCallback(() => {
    activeRef.current = true;
    setEngaged(true);
    const cur = currentRef.current;
    if (cur && status.isLoaded && loadedKeyRef.current === cur.charStart && !status.playing) {
      player.play(); // resume the current chunk in place
    } else if (cur) {
      void playChunkObject(cur, anchorIndexRef.current, resumeIndexRef.current);
    } else {
      playCanonical(0); // nothing selected → start from the top
    }
  }, [playChunkObject, playCanonical, player, status.isLoaded, status.playing]);

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

  const setSelection = useCallback(
    (charOffset: number, stop: boolean) => {
      const lead = buildLead(text, chunks, charOffset);
      if (!lead) return;
      if (stop) {
        playTokenRef.current++;
        activeRef.current = false;
        setLoading(false);
        player.pause();
      }
      currentRef.current = lead.chunk;
      anchorIndexRef.current = lead.anchorIdx;
      resumeIndexRef.current = lead.resumeIdx;
      setCurrent(lead.chunk);
      setEngaged(true);
    },
    [text, chunks, player],
  );

  const select = useCallback((charOffset: number) => setSelection(charOffset, true), [setSelection]);
  const goTo = useCallback((charOffset: number) => setSelection(charOffset, false), [setSelection]);

  const playFrom = useCallback(
    (charOffset: number) => {
      const lead = buildLead(text, chunks, charOffset);
      if (lead) void playChunkObject(lead.chunk, lead.anchorIdx, lead.resumeIdx);
    },
    [text, chunks, playChunkObject],
  );

  const seek = useCallback(
    (fraction: number) => {
      if (status.isLoaded && status.duration > 0) {
        void player.seekTo(Math.max(0, Math.min(1, fraction)) * status.duration);
      }
    },
    [player, status.isLoaded, status.duration],
  );

  return {
    ready,
    playing: status.playing,
    loading,
    engaged,
    currentChunk: current,
    total: chunks.length,
    positionSec: status.currentTime,
    durationSec: status.duration,
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
  };
}

async function loadEngine(modelId: string, voiceId: string): Promise<{ tts: TextToSpeech; voice: VoiceStyle }> {
  const tts = await loadTextToSpeech(modelId);
  const voice = await loadVoiceStyle(modelId, voiceId);
  return { tts, voice };
}
