import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { usePlayback, useSleepTimer, type Playback, type SleepTimer } from '../hooks';
import type { Chunk, ImportedDocument } from '../types';

// Everything the playback engine needs to read a specific document. A screen
// (the Reader) registers this when it opens a PDF; playback then survives that
// screen unmounting, so audio keeps going as the user navigates the app.
export type ActiveDoc = {
  doc: ImportedDocument;
  /** Canonical chunk list for the document. */
  chunks: Chunk[];
  /** Canonical document text (used to build tap-start "lead" chunks). */
  text: string;
  modelId: string | null;
  voiceId: string;
  speed: number;
  steps: number;
  lang: string;
};

export type PlaybackContextValue = {
  /** The live playback controller (play/pause/seek/state). */
  playback: Playback;
  /** The document currently loaded for playback, or null if none. */
  activeDoc: ActiveDoc | null;
  /** Register/replace the document the engine plays. */
  setActiveDoc: (doc: ActiveDoc) => void;
  /** Register a document AND start playing it from `fromOffset` once the engine
   *  is ready (used by the Library play button for background playback). */
  playDocument: (doc: ActiveDoc, fromOffset?: number) => void;
  /** Forget the active document (e.g. it was deleted) so the engine releases it. */
  clearActiveDoc: () => void;
  /** Sleep timer: pauses playback after a chosen number of minutes. */
  sleep: SleepTimer;
};

// Stable empty references so the "no document" render doesn't churn deps.
const EMPTY_CHUNKS: Chunk[] = [];

const PlaybackContext = createContext<PlaybackContextValue | null>(null);

// Android 13+ suppresses the media/foreground-service notification (and thus the
// lock-screen controls) unless POST_NOTIFICATIONS is granted. Ask once at start.
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
  });

  useEffect(() => {
    void requestNotificationPermission();
  }, []);

  // Keep a ref to pause so the timer's fire callback is stable (the timer hook
  // captures it once; playback.pause is recreated on status changes).
  const pauseRef = useRef(playback.pause);
  pauseRef.current = playback.pause;
  const sleep = useSleepTimer(useCallback(() => pauseRef.current(), []));

  const clearActiveDoc = useCallback(() => setActiveDoc(null), []);

  // A queued "play from here" from the Library. setActiveDoc only takes effect on
  // the next render, so we can't call playFrom synchronously — stash the intent
  // and let the effect below fire it once the engine has registered this doc.
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
