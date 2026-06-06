import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { usePlayback, type Playback } from '../hooks';
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

  const value = useMemo<PlaybackContextValue>(() => ({ playback, activeDoc, setActiveDoc }), [playback, activeDoc]);

  return <PlaybackContext.Provider value={value}>{children}</PlaybackContext.Provider>;
}

export function usePlaybackContext(): PlaybackContextValue {
  const ctx = useContext(PlaybackContext);
  if (!ctx) throw new Error('usePlaybackContext must be used within a PlaybackProvider');
  return ctx;
}
