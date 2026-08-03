import type { PlaybackPlayerPort } from './playbackPlayerControlTypes';

// Keeps native player mutations behind one small, exception-safe boundary.
export class PlaybackPlayerController {
  constructor(
    private readonly player: PlaybackPlayerPort,
    private readonly applyPlaybackRate: () => void,
  ) {}

  load(uri: string): void {
    this.player.replace(uri);
    this.applyPlaybackRate();
  }

  play(): void {
    this.player.play();
  }

  pause(): void {
    this.player.pause();
  }

  seekTo(seconds: number): void {
    try {
      void this.player.seekTo(Math.max(0, seconds));
    } catch {}
  }

  seekFraction(fraction: number, duration: number, isLoaded: boolean): void {
    if (!isLoaded || duration <= 0) return;
    this.seekTo(Math.max(0, Math.min(1, fraction)) * duration);
  }
}
