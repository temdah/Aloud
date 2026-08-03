import type { Playback, UsePlaybackOptions } from './core';
import { usePlaybackSession } from './usePlaybackSession';

export type { Playback, UsePlaybackOptions } from './core';

export function usePlayback(options: UsePlaybackOptions): Playback {
  return usePlaybackSession(options);
}
