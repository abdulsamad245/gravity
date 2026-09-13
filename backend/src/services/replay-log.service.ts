import { appendFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type * as Y from 'yjs';
import { config } from '../config/config';
import { REPLAY_LOG_MAX_ENTRIES } from '../constants/app.constants';
import type { ReplayLogEntryDto } from '../dto/replay.dto';
import { logger } from '../observability/logger';

/**
 * Records every Yjs update per room with a timestamp — the data source
 * for the "time travel" replay feature. Replaying the entries in order
 * into a fresh Y.Doc reproduces the entire session from the beginning.
 *
 * Entries stay in memory for fast replay reads and are also appended to disk
 * as newline-delimited JSON. A restart lazily restores a room log on access.
 */
export class ReplayLogService {
  private readonly logs = new Map<string, ReplayLogEntryDto[]>();
  private readonly attached = new Set<string>();
  private readonly writes = new Map<string, Promise<void>>();
  private readonly logDir: string | null;

  constructor(dataDir?: string) {
    this.logDir = dataDir ? path.resolve(dataDir, 'replay') : null;
  }

  /**
   * Subscribes to a live room document exactly once and appends each
   * update to the room's log.
   */
  attach(roomName: string, doc: Y.Doc): void {
    if (this.attached.has(roomName)) return;
    this.attached.add(roomName);
    const log = this.getLog(roomName);

    doc.on('update', (update: Uint8Array) => {
      // Hard cap: later updates are unrecorded once the room hits REPLAY_LOG_MAX_ENTRIES.
      if (log.length >= REPLAY_LOG_MAX_ENTRIES) return;
      const entry = { t: Date.now(), u: Buffer.from(update).toString('base64') };
      log.push(entry);
      this.append(roomName, entry);
      if (log.length % 1000 === 0) {
        logger.debug({ room: roomName, entries: log.length }, 'Replay log milestone');
      }
    });
    doc.on('destroy', () => this.attached.delete(roomName));
    logger.info({ room: roomName }, 'Replay logging attached');
  }

  getLog(roomName: string): ReplayLogEntryDto[] {
    const existing = this.logs.get(roomName);
    if (existing) return existing;

    const loaded = this.load(roomName);
    this.logs.set(roomName, loaded);
    return loaded;
  }

  async flush(): Promise<void> {
    await Promise.all(this.writes.values());
  }

  private load(roomName: string): ReplayLogEntryDto[] {
    if (!this.logDir) return [];
    try {
      const text = readFileSync(this.logPath(roomName), 'utf8');
      const entries: ReplayLogEntryDto[] = [];
      for (const line of text.split('\n')) {
        if (!line.trim()) continue;
        try {
          const candidate = JSON.parse(line) as Partial<ReplayLogEntryDto>;
          if (typeof candidate.t === 'number' && typeof candidate.u === 'string') {
            entries.push({ t: candidate.t, u: candidate.u });
          }
        } catch {
          logger.warn({ room: roomName }, 'Skipped malformed replay entry');
        }
        if (entries.length >= REPLAY_LOG_MAX_ENTRIES) break;
      }
      logger.info({ room: roomName, entries: entries.length }, 'Replay log restored from durable storage');
      return entries;
    } catch (error) {
      if (!isMissingFile(error)) {
        logger.error({ err: error, room: roomName }, 'Could not restore replay log');
      }
      return [];
    }
  }

  private append(roomName: string, entry: ReplayLogEntryDto): void {
    if (!this.logDir) return;
    const previous = this.writes.get(roomName) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(async () => {
        await mkdir(this.logDir!, { recursive: true });
        await appendFile(this.logPath(roomName), `${JSON.stringify(entry)}\n`, 'utf8');
      })
      .catch((error: unknown) => {
        logger.error({ err: error, room: roomName }, 'Could not persist replay entry');
      });
    this.writes.set(roomName, next);
    void next.finally(() => {
      if (this.writes.get(roomName) === next) this.writes.delete(roomName);
    });
  }

  private logPath(roomName: string): string {
    return path.join(this.logDir!, `${roomName}.ndjson`);
  }
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

/** Singleton - one durable recorder for the whole process. */
export const replayLogService = new ReplayLogService(config.DATA_DIR);
