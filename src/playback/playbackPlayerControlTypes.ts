export type PlaybackPlayerPort = {
  replace: (source: string) => void;
  play: () => void;
  pause: () => void;
  seekTo: (seconds: number) => Promise<void> | void;
};
