import { access, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import * as Y from 'yjs';
import type { Persistence, WSSharedDoc } from 'y-websocket/bin/utils';
import { config } from '../config/config';
import { ROOM_PERSIST_DEBOUNCE_MS } from '../constants/app.constants';
import { logger } from '../observability/logger';

/**
 * File-backed Yjs snapshots with atomic replacement.
 *
 * The service implements y-websocket's persistence seam, so rooms hydrate when
 * first opened and are evicted from memory after the final client disconnects.
 * Active rooms are snapshotted after a short debounce to bound crash exposure.
 */
export class RoomPersistenceService implements Persistence {
  private readonly roomDir: string;
  private readonly timers = new Map<string, NodeJS.Timeout>();
  private readonly writes = new Map<string, Promise<void>>();

  constructor(dataDir = config.DATA_DIR) {
    this.roomDir = path.resolve(dataDir, 'rooms');
  }

  async bindState(roomName: string, doc: WSSharedDoc): Promise<void> {
    await mkdir(this.roomDir, { recursive: true });
    try {
      const snapshot = await readFile(this.roomPath(roomName));
      Y.applyUpdate(doc, snapshot);
      logger.info({ room: roomName, bytes: snapshot.byteLength }, 'Room restored from durable storage');
    } catch (error) {
      if (!isMissingFile(error)) {
        logger.error({ err: error, room: roomName }, 'Could not restore room snapshot');
      }
    }

    doc.on('update', () => this.schedule(roomName, doc));
  }

  async writeState(roomName: string, doc: WSSharedDoc): Promise<void> {
    const timer = this.timers.get(roomName);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(roomName);
    }
    await this.persist(roomName, doc);
  }

  async flushAll(docs: Iterable<[string, WSSharedDoc]>): Promise<void> {
    await Promise.all(Array.from(docs, ([roomName, doc]) => this.writeState(roomName, doc)));
    await Promise.all(this.writes.values());
  }

  /** True when a durable snapshot exists for this room name. */
  async hasSnapshot(roomName: string): Promise<boolean> {
    try {
      await access(this.roomPath(roomName));
      return true;
    } catch (error) {
      if (isMissingFile(error)) return false;
      logger.error({ err: error, room: roomName }, 'Could not check room snapshot');
      throw error;
    }
  }

  private schedule(roomName: string, doc: WSSharedDoc): void {
    const current = this.timers.get(roomName);
    if (current) clearTimeout(current);
    const timer = setTimeout(() => {
      this.timers.delete(roomName);
      void this.persist(roomName, doc);
    }, ROOM_PERSIST_DEBOUNCE_MS);
    timer.unref();
    this.timers.set(roomName, timer);
  }

  private async persist(roomName: string, doc: Y.Doc): Promise<void> {
    const snapshot = Y.encodeStateAsUpdate(doc);
    const previous = this.writes.get(roomName) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        await mkdir(this.roomDir, { recursive: true });
        const destination = this.roomPath(roomName);
        const temporary = `${destination}.${process.pid}.tmp`;
        await writeFile(temporary, snapshot);
        await rename(temporary, destination);
        logger.debug({ room: roomName, bytes: snapshot.byteLength }, 'Room snapshot persisted');
      })
      .catch((error: unknown) => {
        logger.error({ err: error, room: roomName }, 'Could not persist room snapshot');
        throw error;
      });

    this.writes.set(roomName, next);
    try {
      await next;
    } finally {
      if (this.writes.get(roomName) === next) this.writes.delete(roomName);
    }
  }

  private roomPath(roomName: string): string {
    return path.join(this.roomDir, `${roomName}.yjs`);
  }
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

export const roomPersistenceService = new RoomPersistenceService();
