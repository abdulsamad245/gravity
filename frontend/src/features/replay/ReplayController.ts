import * as Y from 'yjs';
import type { ReplayLogEntry } from '../../shared/api/client';
import { clamp } from '../../shared/utils/geometry';

/**
 * Rebuilds the session by applying the server's recorded update log into a
 * fresh, read-only Y.Doc. Forward seeks apply missing updates only; backward
 * seeks rebuild from an empty doc.
 */
export class ReplayController {
  private doc = new Y.Doc();
  index = 0;

  constructor(readonly entries: ReplayLogEntry[]) {}

  get length(): number {
    return this.entries.length;
  }

  get objects(): Y.Map<Y.Map<unknown>> {
    return this.doc.getMap('objects');
  }

  timestampAt(i: number): number | null {
    const entry = this.entries[clamp(i, 0, this.entries.length - 1)];
    return entry?.t ?? null;
  }

  seek(to: number): Y.Map<Y.Map<unknown>> {
    to = clamp(Math.round(to), 0, this.entries.length);
    if (to < this.index) {
      this.doc.destroy();
      this.doc = new Y.Doc();
      this.index = 0;
    }
    for (let i = this.index; i < to; i++) {
      Y.applyUpdate(this.doc, base64ToBytes(this.entries[i].u));
    }
    this.index = to;
    return this.objects;
  }

  destroy(): void {
    this.doc.destroy();
  }
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
