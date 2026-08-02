import { setAudioModeAsync } from 'expo-audio';
import { useCallback, useEffect, useRef } from 'react';
import { resolvePlaybackArtworkUrl } from './playbackArtwork';
import type {
  PlaybackLockMetadata,
  PlaybackMediaSession,
  PlaybackMediaSessionOptions,
} from './playbackMediaSessionTypes';

const LOCK_OPTIONS = { showSeekForward: true, showSeekBackward: true, showSpeed: true } as const;
const RATE_MIRROR_GUARD_MS = 1000;

export function buildPlaybackLockMetadata(
  title?: string,
  artist?: string,
  artworkUrl?: string,
): PlaybackLockMetadata {
  return {
    title: title?.trim() || 'Document',
    artist: artist?.trim() || 'Aloud',
    albumTitle: 'Aloud',
    ...(artworkUrl ? { artworkUrl } : {}),
  };
}

export function mirroredPlaybackRate(
  requestedRate: number,
  reportedRate: number,
  isLoaded: boolean,
  playing: boolean,
  lastAppliedAt: number,
  now: number,
): number | null {
  if (!isLoaded || !playing || now - lastAppliedAt < RATE_MIRROR_GUARD_MS) return null;
  if (reportedRate <= 0 || Math.abs(reportedRate - requestedRate) <= 0.02) return null;
  return Math.round(reportedRate * 100) / 100;
}

// Owns the native audio session, playback rate, and lock-screen notification.
export function usePlaybackMediaSession(options: PlaybackMediaSessionOptions): PlaybackMediaSession {
  const {
    player,
    title,
    artist,
    accentColor,
    singleItem,
    speed,
    isLoaded,
    playing,
    reportedRate,
    onExternalSpeedChange,
  } = options;
  const lockScreenActiveRef = useRef(false);
  const metadataRef = useRef(buildPlaybackLockMetadata(title, artist));
  const rateAppliedAtRef = useRef(0);

  const releaseLockScreen = useCallback(() => {
    try {
      player.clearLockScreenControls?.();
    } catch {}
    lockScreenActiveRef.current = false;
  }, [player]);

  const applyPlaybackRate = useCallback(() => {
    try {
      player.setPlaybackRate(speed, 'high');
      rateAppliedAtRef.current = Date.now();
    } catch {}
  }, [player, speed]);

  const claimLockScreen = useCallback(() => {
    if (lockScreenActiveRef.current) return;
    try {
      const { artworkUrl, ...metadata } = metadataRef.current;
      player.setActiveForLockScreen(true, metadata, {
        ...LOCK_OPTIONS,
        accentColor,
        isLiveStream: !singleItem,
      });
      lockScreenActiveRef.current = true;
      if (artworkUrl) {
        try {
          player.updateLockScreenMetadata?.(metadataRef.current);
        } catch {}
      }
    } catch (error) {
      console.warn('[playback] failed to activate lock-screen controls:', error);
    }
  }, [player, accentColor, singleItem]);

  useEffect(() => {
    metadataRef.current = buildPlaybackLockMetadata(title, artist, metadataRef.current.artworkUrl);
    if (!lockScreenActiveRef.current) return;
    try {
      player.updateLockScreenMetadata?.(metadataRef.current);
    } catch {}
  }, [player, title, artist]);

  useEffect(() => {
    let active = true;
    void resolvePlaybackArtworkUrl().then((artworkUrl) => {
      if (!active || !artworkUrl) return;
      metadataRef.current = { ...metadataRef.current, artworkUrl };
      if (!lockScreenActiveRef.current) return;
      try {
        player.updateLockScreenMetadata?.(metadataRef.current);
      } catch {}
    });
    return () => { active = false; };
  }, [player]);

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch((error) => console.warn('[playback] failed to set audio mode:', error));
  }, []);

  useEffect(() => applyPlaybackRate(), [applyPlaybackRate]);

  useEffect(() => {
    const externalRate = mirroredPlaybackRate(
      speed,
      reportedRate,
      isLoaded,
      playing,
      rateAppliedAtRef.current,
      Date.now(),
    );
    if (externalRate != null) onExternalSpeedChange(externalRate);
  }, [speed, reportedRate, isLoaded, playing, onExternalSpeedChange]);

  useEffect(() => () => {
    releaseLockScreen();
    try {
      player.remove?.();
    } catch {}
  }, [player, releaseLockScreen]);

  return { claimLockScreen, releaseLockScreen, applyPlaybackRate };
}
