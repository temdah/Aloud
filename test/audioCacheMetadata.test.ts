import assert from 'node:assert/strict';
import { jest, test } from '@jest/globals';

const mockRegistry = { failWrites: true, writes: 0 };

jest.mock('expo-file-system', () => {
  function uriPart(value: unknown): string {
    return typeof value === 'string' ? value : (value as { uri: string }).uri;
  }

  class Directory {
    readonly uri: string;
    exists = true;

    constructor(...parts: unknown[]) {
      this.uri = parts.map(uriPart).join('/');
    }

    create() {}
    delete() {}
    list() { return []; }
  }

  class File {
    readonly uri: string;
    exists = false;
    size = 0;

    constructor(...parts: unknown[]) {
      this.uri = parts.map(uriPart).join('/');
    }

    create() {}
    delete() {}
    textSync() { return '{}'; }
    write() {
      if (!this.uri.endsWith('profiles.json')) return;
      mockRegistry.writes++;
      if (mockRegistry.failWrites) throw new Error('disk full');
    }
  }

  return { Directory, File, Paths: { cache: 'cache', document: 'document' } };
});

import { recordCachedProfile, type NarrationSettings } from '../src/supertonic';

test('cache profile metadata failures do not escape and are retried', () => {
  const settings: NarrationSettings = {
    modelId: 'model-a',
    voiceId: 'voice-a',
    speed: 1,
    steps: 8,
    lang: 'en',
    quality: 'quality',
    tone: 'neutral',
  };

  assert.doesNotThrow(() => recordCachedProfile('metadata-failure', settings));
  mockRegistry.failWrites = false;
  assert.doesNotThrow(() => recordCachedProfile('metadata-failure', settings));
  assert.equal(mockRegistry.writes, 2);
});
