import type { AudioPlayer } from 'expo-audio';

export type PlaybackLockMetadata = {
  title: string;
  artist: string;
  albumTitle: string;
  artworkUrl?: string;
};

export type PlaybackMediaSessionOptions = {
  player: AudioPlayer;
  title?: string;
  artist?: string;
  accentColor: string;
  singleItem: boolean;
  speed: number;
  isLoaded: boolean;
  playing: boolean;
  reportedRate: number;
  onExternalSpeedChange: (speed: number) => void;
};

export type PlaybackMediaSession = {
  claimLockScreen: () => void;
  releaseLockScreen: () => void;
  applyPlaybackRate: () => void;
};
