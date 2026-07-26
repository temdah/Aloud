import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { usePlayback, useSleepTimer, type Playback, type SleepTimer } from '../hooks';
import type { Chunk, ImportedDocument } from '../types';

// Everything playback needs to read a document. The Reader registers this on
// open; playback then survives that screen unmounting, so audio keeps going.
export type ActiveDoc = {
  doc: ImportedDocument;
  chunks: Chunk[];
  text: string;
  modelId: string | null;
  voiceId: string;
  speed: number;
  steps: number;
  lang: string;
  // Route an OS-notification speed change to the right source (per-doc pin or global).
  onSpeedChange?: (speed: number) => void;
};

export type PlaybackContextValue = {
  playback: Playback;
  activeDoc: ActiveDoc | null;
  setActiveDoc: (doc: ActiveDoc) => void;
  // Register a doc AND start it from an offset once ready (Library background play).
  playDocument: (doc: ActiveDoc, fromOffset?: number) => void;
  clearActiveDoc: () => void;
  sleep: SleepTimer;
};

const EMPTY_CHUNKS: Chunk[] = [];

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
    chunks: activeDoc?.chunks ?? EMPTY_CHUNKS,
    text: activeDoc?.text ?? '',
    modelId: activeDoc?.modelId ?? null,
    voiceId: activeDoc?.voiceId ?? '',
    speed: activeDoc?.speed ?? 1,
    steps: activeDoc?.steps ?? 1,
    lang: activeDoc?.lang ?? 'en',
    title: activeDoc?.doc.title,
    onSpeedChange: activeDoc?.onSpeedChange,
  });

  useEffect(() => {
    void requestNotificationPermission();
  }, []);

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
