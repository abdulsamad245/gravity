import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';
import { RoomPersistenceService } from '../../src/services/room-persistence.service';
import type { WSSharedDoc } from 'y-websocket/bin/utils';

describe('RoomPersistenceService', () => {
  let dir: string;

  afterEach(async () => {
    vi.useRealTimers();
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it('restores a room snapshot into a fresh document', async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'gravity-rooms-'));
    const service = new RoomPersistenceService(dir);
    const source = new Y.Doc() as WSSharedDoc;
    source.getMap('objects').set('sticky-1', 'hello');

    await service.writeState('room-a', source);

    const restored = new Y.Doc() as WSSharedDoc;
    await service.bindState('room-a', restored);
    expect(restored.getMap('objects').get('sticky-1')).toBe('hello');

    const bytes = await readFile(path.join(dir, 'rooms', 'room-a.yjs'));
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it('debounces live updates into a durable snapshot', async () => {
    vi.useFakeTimers();
    dir = await mkdtemp(path.join(os.tmpdir(), 'gravity-rooms-'));
    const service = new RoomPersistenceService(dir);
    const doc = new Y.Doc() as WSSharedDoc;
    await service.bindState('room-b', doc);

    doc.getMap('objects').set('a', 1);
    await vi.advanceTimersByTimeAsync(1100);
    await service.flushAll([['room-b', doc]]);

    const next = new RoomPersistenceService(dir);
    const restored = new Y.Doc() as WSSharedDoc;
    await next.bindState('room-b', restored);
    expect(restored.getMap('objects').get('a')).toBe(1);
  });
});
