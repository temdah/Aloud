import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, PermissionsAndroid, Platform } from 'react-native';
import { DEFAULT_NARRATION_TONE, DEFAULT_QUALITY, EMPTY_NARRATION_PLAN, getEngine, isEngineResident, MIN_SYNTHESIS_STEPS, releaseCurrentEngine } from '../supertonic';
import { useSettingsStore } from '../stores';
import type { ActiveDoc, PlaybackContextValue } from './playbackContextTypes';
import { usePlayback } from './usePlayback';
import { useSleepTimer } from './useSleepTimer';

export type { ActiveDoc, PlaybackContextValue } from './playbackContextTypes';

const PlaybackContext = createContext<PlaybackContextValue | null>(null);

// Android 13+ hides the media notification unless POST_NOTIFICATIONS is granted.
async function requestNotificationPermission(): Promise<void> {
  if (Platform.OS !== 'android' || Platform.Version < 33) return;
  try {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
  } catch {
    // Denied/unsupported — playback still works, just without the notification.
  }
}

export function PlaybackProvider({ children }: { children: ReactNode }) {
  const [activeDoc, setActiveDoc] = useState<ActiveDoc | null>(null);

  const playback = usePlayback({
    docHash: activeDoc?.doc.docHash ?? '',
    plan: activeDoc?.plan ?? EMPTY_NARRATION_PLAN,
    modelId: activeDoc?.modelId ?? null,
    voiceId: activeDoc?.voiceId ?? '',
    speed: activeDoc?.speed ?? 1,
    steps: activeDoc?.steps ?? MIN_SYNTHESIS_STEPS,
    lang: activeDoc?.lang ?? 'en',
    quality: activeDoc?.quality ?? DEFAULT_QUALITY,
    tone: activeDoc?.tone ?? DEFAULT_NARRATION_TONE,
    title: activeDoc?.doc.title,
    onSpeedChange: activeDoc?.onSpeedChange,
  });

  useEffect(() => {
    void requestNotificationPermission();
  }, []);

  // Warm the engine ahead of play: as soon as a model is set, and whenever the
  // app returns to the foreground. getEngine is idempotent, so this is a no-op
  // when already resident. An idle loaded engine costs RAM, not battery/CPU — so
  // by default it stays hot; with keepEngineWarm off it's released on background
  // when nothing is playing, to save memory on low-RAM devices.
  const modelId = useSettingsStore((s) => s.modelId);
  const keepEngineWarm = useSettingsStore((s) => s.keepEngineWarm);
  const keepWarmRef = useRef(keepEngineWarm);
  keepWarmRef.current = keepEngineWarm;
  const startedRef = useRef(playback.started);
  startedRef.current = playback.started;

  useEffect(() => {
    if (modelId && !isEngineResident(modelId)) void getEngine(modelId).catch(() => {});
  }, [modelId]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        if (modelId && !isEngineResident(modelId)) void getEngine(modelId).catch(() => {});
      } else if (state === 'background' && !keepWarmRef.current && !startedRef.current) {
        void releaseCurrentEngine().catch(() => {});
      }
    });
    return () => sub.remove();
  }, [modelId]);

  // Stable pause ref — the sleep timer captures its callback once.
  const pauseRef = useRef(playback.pause);
  pauseRef.current = playback.pause;
  const sleep = useSleepTimer(useCallback(() => pauseRef.current(), []));

  const clearActiveDoc = useCallback(() => setActiveDoc(null), []);

  // setActiveDoc applies next render, so stash the "play from here" intent and
  // fire it once the engine has registered this doc.
  const pendingPlayRef = useRef<{ docHash: string; offset: number } | null>(null);
  const playDocument = useCallback((doc: ActiveDoc, fromOffset = 0) => {
    pendingPlayRef.current = { docHash: doc.doc.docHash, offset: fromOffset };
    setActiveDoc(doc);
  }, []);

  useEffect(() => {
    const pending = pendingPlayRef.current;
    if (!pending || activeDoc?.doc.docHash !== pending.docHash || !playback.ready) return;
    pendingPlayRef.current = null;
    if (pending.offset > 0) playback.playFrom(pending.offset);
    else playback.play();
  }, [activeDoc?.doc.docHash, playback.ready, playback]);

  const value = useMemo<PlaybackContextValue>(
    () => ({ playback, activeDoc, setActiveDoc, playDocument, clearActiveDoc, sleep }),
    [playback, activeDoc, playDocument, clearActiveDoc, sleep],
  );

  return <PlaybackContext.Provider value={value}>{children}</PlaybackContext.Provider>;
}

export function usePlaybackContext(): PlaybackContextValue {
  const ctx = useContext(PlaybackContext);
  if (!ctx) throw new Error('usePlaybackContext must be used within a PlaybackProvider');
  return ctx;
}
