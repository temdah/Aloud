import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ensureChunkAudio, loadTextToSpeech, loadVoiceStyle } from '../supertonic';
import type { NarrationSettings, TextToSpeech, VoiceStyle } from '../supertonic';
import type { Chunk } from '../types';

export type UsePlaybackOptions = {
  /** PDF content hash — the audio-cache namespace for this document. */
  docHash: string;
  /** Ordered chunk list (from loadChunks / the canonical stream). */
  chunks: Chunk[];
  voiceId: string;
  speed: number;
  steps: number;
  lang?: string;
};

export type Playback = {
  ready: boolean;
  playing: boolean;
  index: number;
  total: number;
  /** Current chunk (its [charStart,charEnd) drives chunk-level highlighting). */
  currentChunk: Chunk | null;
  positionSec: number;
  durationSec: number;
  toggle: () => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  seekToChunk: (index: number) => void;
  /** Tap-to-start: begin at the chunk containing this global char offset. */
  startFromCharOffset: (charOffset: number) => void;
};

// Sequential, cached, generate-ahead playback over the canonical chunk list.
// Highlighting is chunk-level (via currentChunk's char range) until per-word
// Map B timings exist. NOTE: untested on device — validate chunk-to-chunk
// transitions and didJustFinish timing on hardware.
export function usePlayback({ docHash, chunks, voiceId, speed, steps, lang = 'en' }: UsePlaybackOptions): Playback {
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);

  const [ready, setReady] = useState(false);
  const [index, setIndex] = useState(0);

  const engineRef = useRef<{ tts: TextToSpeech; voice: VoiceStyle } | null>(null);
  const activeRef = useRef(false);
  const indexRef = useRef(0);
  const finishedHandledRef = useRef(false);

  const settings = useMemo<NarrationSettings>(
    () => ({ voiceId, speed, steps, lang }),
    [voiceId, speed, steps, lang],
  );

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    engineRef.current = null;
    loadEngine(voiceId)
      .then((engine) => {
        if (cancelled) return;
        engineRef.current = engine;
        setReady(true);
      })
      .catch((e) => console.warn('[usePlayback] failed to load engine/voice:', e));
    return () => {
      cancelled = true;
    };
  }, [voiceId]);

  const playChunk = useCallback(
    async (i: number) => {
      const engine = engineRef.current;
      if (!engine || i < 0 || i >= chunks.length) return;
      setIndex(i);
      indexRef.current = i;
      try {
        const uri = await ensureChunkAudio(engine.tts, engine.voice, docHash, chunks[i], settings);
        await setAudioModeAsync({ playsInSilentMode: true });
        player.replace(uri);
        player.play();
        const ahead = chunks[i + 1];
        if (ahead) void ensureChunkAudio(engine.tts, engine.voice, docHash, ahead, settings).catch(() => {});
      } catch (e) {
        console.warn('[usePlayback] failed to play chunk', i, e);
      }
    },
    [chunks, docHash, player, settings],
  );

  useEffect(() => {
    if (status.didJustFinish && !finishedHandledRef.current) {
      finishedHandledRef.current = true;
      const nextIndex = indexRef.current + 1;
      if (activeRef.current && nextIndex < chunks.length) void playChunk(nextIndex);
      else activeRef.current = false;
    }
    if (!status.didJustFinish) finishedHandledRef.current = false;
  }, [status.didJustFinish, chunks.length, playChunk]);

  const play = useCallback(() => {
    activeRef.current = true;
    if (status.isLoaded && !status.playing) player.play();
    else void playChunk(indexRef.current);
  }, [playChunk, player, status.isLoaded, status.playing]);

  const pause = useCallback(() => {
    activeRef.current = false;
    player.pause();
  }, [player]);

  const toggle = useCallback(() => {
    if (status.playing) pause();
    else play();
  }, [status.playing, play, pause]);

  const next = useCallback(() => {
    activeRef.current = true;
    void playChunk(Math.min(chunks.length - 1, indexRef.current + 1));
  }, [chunks.length, playChunk]);

  const previous = useCallback(() => {
    activeRef.current = true;
    void playChunk(Math.max(0, indexRef.current - 1));
  }, [playChunk]);

  const seekToChunk = useCallback(
    (i: number) => {
      activeRef.current = true;
      void playChunk(i);
    },
    [playChunk],
  );

  const startFromCharOffset = useCallback(
    (charOffset: number) => {
      const i = chunks.findIndex((c) => charOffset >= c.charStart && charOffset < c.charEnd);
      if (i >= 0) {
        activeRef.current = true;
        void playChunk(i);
      }
    },
    [chunks, playChunk],
  );

  return {
    ready,
    playing: status.playing,
    index,
    total: chunks.length,
    currentChunk: chunks[index] ?? null,
    positionSec: status.currentTime,
    durationSec: status.duration,
    toggle,
    play,
    pause,
    next,
    previous,
    seekToChunk,
    startFromCharOffset,
  };
}

async function loadEngine(voiceId: string): Promise<{ tts: TextToSpeech; voice: VoiceStyle }> {
  const tts = await loadTextToSpeech();
  const voice = await loadVoiceStyle(voiceId);
  return { tts, voice };
}
