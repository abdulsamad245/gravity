import { beforeEach, describe, expect, it } from 'vitest';
import { loadRoomSession, persistRoomSession } from './room-session-storage';

function mockSessionStorage() {
  const map = new Map<string, string>();
  const api = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => {
      map.set(k, v);
    },
    removeItem: (k: string) => {
      map.delete(k);
    },
    clear: () => {
      map.clear();
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    get length() {
      return map.size;
    },
  };
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: api,
    configurable: true,
  });
  return api;
}

describe('room-session-storage', () => {
  beforeEach(() => {
    mockSessionStorage().clear();
  });

  it('round-trips camera, selection, tool, and Orbit open', () => {
    persistRoomSession('roomA', 'user1', {
      view: { x: 120, y: -40, scale: 1.25 },
      selectedIds: ['a', 'b'],
      tool: 'sticky',
      orbitOpen: true,
    });
    const loaded = loadRoomSession('roomA', 'user1');
    expect(loaded?.view).toEqual({ x: 120, y: -40, scale: 1.25 });
    expect(loaded?.selectedIds).toEqual(['a', 'b']);
    expect(loaded?.tool).toBe('sticky');
    expect(loaded?.orbitOpen).toBe(true);
  });

  it('does not mix rooms or users', () => {
    persistRoomSession('roomA', 'user1', {
      view: { x: 1, y: 2, scale: 1 },
      selectedIds: [],
      tool: 'select',
      orbitOpen: false,
    });
    expect(loadRoomSession('roomB', 'user1')).toBeNull();
    expect(loadRoomSession('roomA', 'user2')).toBeNull();
  });

  it('clamps invalid zoom and rejects corrupt payloads', () => {
    persistRoomSession('roomA', 'user1', {
      view: { x: 0, y: 0, scale: 99 },
      selectedIds: [],
      tool: 'select',
      orbitOpen: false,
    });
    expect(loadRoomSession('roomA', 'user1')?.view.scale).toBeLessThanOrEqual(8);

    sessionStorage.setItem(
      'gravity.room.session.v1:roomA:user1',
      JSON.stringify({ version: 99, view: { x: 0, y: 0, scale: 1 } }),
    );
    expect(loadRoomSession('roomA', 'user1')).toBeNull();

    sessionStorage.setItem('gravity.room.session.v1:roomA:user1', '{not-json');
    expect(loadRoomSession('roomA', 'user1')).toBeNull();
  });

  it('falls back to select for unknown tools and ignores empty keys', () => {
    sessionStorage.setItem(
      'gravity.room.session.v1:roomA:user1',
      JSON.stringify({
        version: 1,
        view: { x: 0, y: 0, scale: 1 },
        selectedIds: ['ok', '', 12],
        tool: 'not-a-tool',
        orbitOpen: 'yes',
      }),
    );
    const loaded = loadRoomSession('roomA', 'user1');
    expect(loaded?.tool).toBe('select');
    expect(loaded?.selectedIds).toEqual(['ok']);
    expect(loaded?.orbitOpen).toBe(false);
    expect(loadRoomSession('', 'user1')).toBeNull();
  });
});
