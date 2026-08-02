import assert from 'node:assert/strict';
import test from 'node:test';
import { InferenceQueue } from '../src/supertonic';

test('InferenceQueue serializes work and prioritizes foreground waiters', async () => {
  const queue = new InferenceQueue();
  const order: string[] = [];
  let releaseFirst!: () => void;
  const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });

  const first = queue.enqueue(async () => {
    order.push('background-active');
    await firstGate;
  }, 'background');
  const background = queue.enqueue(async () => { order.push('background-waiting'); }, 'background');
  const foreground = queue.enqueue(async () => { order.push('foreground'); }, 'foreground');

  assert.deepEqual(queue.snapshot(), { running: true, foregroundPending: 1, backgroundPending: 1 });
  releaseFirst();
  await Promise.all([first, background, foreground]);

  assert.deepEqual(order, ['background-active', 'foreground', 'background-waiting']);
  assert.deepEqual(queue.snapshot(), { running: false, foregroundPending: 0, backgroundPending: 0 });
});

test('InferenceQueue continues after a rejected task', async () => {
  const queue = new InferenceQueue();
  const failed = queue.enqueue(async () => { throw new Error('failed'); }, 'foreground');
  const recovered = queue.enqueue(async () => 'ok', 'background');

  await assert.rejects(failed, /failed/);
  assert.equal(await recovered, 'ok');
});
