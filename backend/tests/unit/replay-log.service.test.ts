import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { ReplayLogService } from '../../src/services/replay-log.service';

let tempDir: string | undefined;

afterEach(async () => {
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  }
});

describe('ReplayLogService', () => {
  it('records every update with a timestamp and base64 payload', () => {
    const service = new ReplayLogService();
    const doc = new Y.Doc();
    service.attach('room1', doc);

    doc.getMap('objects').set('a', 1);
    doc.getMap('objects').set('b', 2);

    const log = service.getLog('room1');
    expect(log).toHaveLength(2);
    expect(log[0].t).toBeTypeOf('number');
    expect(() => Buffer.from(log[0].u, 'base64')).not.toThrow();
  });

  it('replaying the log into a fresh doc reproduces the state (time travel)', () => {
    const service = new ReplayLogService();
    const doc = new Y.Doc();
    service.attach('room2', doc);

    doc.getMap('objects').set('x', 42);
    doc.getMap('objects').set('y', 'hello');
    doc.getMap('objects').delete('x');

    const fresh = new Y.Doc();
    for (const entry of service.getLog('room2')) {
      Y.applyUpdate(fresh, Buffer.from(entry.u, 'base64'));
    }
    expect(fresh.getMap('objects').get('y')).toBe('hello');
    expect(fresh.getMap('objects').has('x')).toBe(false);
  });

  it('attaching twice does not double-log updates', () => {
    const service = new ReplayLogService();
    const doc = new Y.Doc();
    service.attach('room3', doc);
    service.attach('room3', doc);

    doc.getMap('objects').set('a', 1);
    expect(service.getLog('room3')).toHaveLength(1);
  });

  it('returns an empty log for unknown rooms', () => {
    const service = new ReplayLogService();
    expect(service.getLog('nope')).toEqual([]);
  });

  it('restores appended entries from durable NDJSON storage', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'gravity-replay-'));
    const writer = new ReplayLogService(tempDir);
    const doc = new Y.Doc();
    writer.attach('room-disk', doc);
    doc.getMap('objects').set('x', 7);
    doc.getMap('objects').set('y', 'persisted');
    await writer.flush();

    const reader = new ReplayLogService(tempDir);
    const log = reader.getLog('room-disk');
    expect(log.length).toBeGreaterThanOrEqual(2);

    const fresh = new Y.Doc();
    for (const entry of log) {
      Y.applyUpdate(fresh, Buffer.from(entry.u, 'base64'));
    }
    expect(fresh.getMap('objects').get('y')).toBe('persisted');
  });
});
