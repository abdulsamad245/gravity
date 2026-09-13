import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';
import { ReplayController } from '../../src/features/replay/ReplayController';
import type { ReplayLogEntry } from '../../src/shared/api/client';

/** Builds a fake server log by recording updates from a scripted session. */
function recordSession(): ReplayLogEntry[] {
  const doc = new Y.Doc();
  const entries: ReplayLogEntry[] = [];
  doc.on('update', (u: Uint8Array) => {
    entries.push({ t: Date.now(), u: Buffer.from(u).toString('base64') });
  });
  const objects = doc.getMap<Y.Map<unknown>>('objects');

  doc.transact(() => {
    const m = new Y.Map<unknown>();
    m.set('id', 'a');
    m.set('x', 0);
    objects.set('a', m);
  });
  doc.transact(() => objects.get('a')!.set('x', 100));
  doc.transact(() => objects.delete('a'));
  return entries;
}

describe('ReplayController (time travel)', () => {
  it('seeks forward through the session incrementally', () => {
    const rc = new ReplayController(recordSession());
    expect(rc.length).toBe(3);

    let map = rc.seek(1);
    expect((map.get('a') as Y.Map<unknown>).get('x')).toBe(0);

    map = rc.seek(2);
    expect((map.get('a') as Y.Map<unknown>).get('x')).toBe(100);

    map = rc.seek(3);
    expect(map.has('a')).toBe(false);
  });

  it('seeks backward by rebuilding from the beginning', () => {
    const rc = new ReplayController(recordSession());
    rc.seek(3);
    const map = rc.seek(1);
    expect((map.get('a') as Y.Map<unknown>).get('x')).toBe(0);
  });

  it('clamps out-of-range seeks', () => {
    const rc = new ReplayController(recordSession());
    rc.seek(999);
    expect(rc.index).toBe(3);
    rc.seek(-5);
    expect(rc.index).toBe(0);
  });
});
