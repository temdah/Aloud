import assert from 'node:assert/strict';
import { test } from '@jest/globals';
import { PlaybackPlayerController, type PlaybackPlayerPort } from '../src/playback';

test('PlaybackPlayerController loads audio before applying its rate', () => {
  const calls: string[] = [];
  const player: PlaybackPlayerPort = {
    replace: (uri) => { calls.push(`load:${uri}`); },
    play: () => { calls.push('play'); },
    pause: () => { calls.push('pause'); },
    seekTo: (seconds) => { calls.push(`seek:${seconds}`); },
  };
  const controller = new PlaybackPlayerController(player, () => { calls.push('rate'); });

  controller.load('clip.m4a');
  controller.play();
  controller.pause();

  assert.deepEqual(calls, ['load:clip.m4a', 'rate', 'play', 'pause']);
});

test('PlaybackPlayerController clamps seek requests and ignores unavailable media', () => {
  const seeks: number[] = [];
  const player: PlaybackPlayerPort = {
    replace: () => {},
    play: () => {},
    pause: () => {},
    seekTo: (seconds) => { seeks.push(seconds); },
  };
  const controller = new PlaybackPlayerController(player, () => {});

  controller.seekFraction(2, 20, true);
  controller.seekFraction(0.5, 0, true);
  controller.seekFraction(0.5, 20, false);
  controller.seekTo(-4);

  assert.deepEqual(seeks, [20, 0]);
});
