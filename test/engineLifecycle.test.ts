import assert from 'node:assert/strict';
import { test } from '@jest/globals';
import { EngineLifecycle } from '../src/supertonic';

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
}

test('EngineLifecycle waits for active inference before releasing', async () => {
  const events: string[] = [];
  const started = deferred();
  const finish = deferred();
  const lifecycle = new EngineLifecycle<string>({
    load: async (key) => {
      events.push(`load:${key}`);
      return key;
    },
    release: async (_, key) => { events.push(`release:${key}`); },
  });

  const use = lifecycle.use('model-a', async () => {
    events.push('use:start');
    started.resolve();
    await finish.promise;
    events.push('use:end');
  });
  await started.promise;
  const release = lifecycle.releaseCurrent();
  await Promise.resolve();

  assert.deepEqual(events, ['load:model-a', 'use:start']);
  finish.resolve();
  await Promise.all([use, release]);
  assert.deepEqual(events, ['load:model-a', 'use:start', 'use:end', 'release:model-a']);
});

test('EngineLifecycle completes active inference before swapping models', async () => {
  const events: string[] = [];
  const started = deferred();
  const finish = deferred();
  const lifecycle = new EngineLifecycle<string>({
    load: async (key) => {
      events.push(`load:${key}`);
      return key;
    },
    release: async (_, key) => { events.push(`release:${key}`); },
  });

  const use = lifecycle.use('model-a', async () => {
    events.push('use:start');
    started.resolve();
    await finish.promise;
    events.push('use:end');
  });
  await started.promise;
  const next = lifecycle.get('model-b');
  await Promise.resolve();

  assert.deepEqual(events, ['load:model-a', 'use:start']);
  finish.resolve();
  assert.equal(await next, 'model-b');
  await use;
  assert.deepEqual(events, ['load:model-a', 'use:start', 'use:end', 'release:model-a', 'load:model-b']);
});

test('EngineLifecycle deduplicates loads and recovers after a failed load', async () => {
  let loads = 0;
  const lifecycle = new EngineLifecycle<string>({
    load: async (key) => {
      loads++;
      if (key === 'broken') throw new Error('load failed');
      return key;
    },
    release: async () => {},
  });

  await assert.rejects(lifecycle.get('broken'), /load failed/);
  const [first, second] = await Promise.all([lifecycle.get('model-a'), lifecycle.get('model-a')]);

  assert.equal(first, 'model-a');
  assert.equal(second, 'model-a');
  assert.equal(loads, 2);
});
