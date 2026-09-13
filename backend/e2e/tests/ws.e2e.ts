import { afterEach, describe, expect, it } from 'vitest';
import { apiJson, type ApiSuccess } from '../helpers/http.js';
import {
  connectYjsRoom,
  openRawSocket,
  waitForClose,
  type ConnectedRoom,
} from '../helpers/ws.js';

describe('WebSocket black-box', () => {
  const rooms: ConnectedRoom[] = [];

  afterEach(() => {
    while (rooms.length) rooms.pop()?.destroy();
  });

  it('rejects invalid room names with close code 4400', async () => {
    const socket = openRawSocket('/ws/ab');
    const closed = await waitForClose(socket, 10_000);
    expect(closed.code).toBe(4400);
  });

  it('syncs a Y.Map between two clients and marks the room live', async () => {
    const roomId = `e2e_sync_${Date.now()}`;

    const before = await apiJson<ApiSuccess<{ exists: boolean }>>(
      `/api/v1/rooms/${roomId}/exists`,
    );
    expect(before.body.data.exists).toBe(false);

    const a = await connectYjsRoom(roomId);
    rooms.push(a);

    const live = await apiJson<ApiSuccess<{ exists: boolean }>>(
      `/api/v1/rooms/${roomId}/exists`,
    );
    expect(live.body.data.exists).toBe(true);

    a.doc.getMap('e2e').set('hello', 'gravity');

    const b = await connectYjsRoom(roomId);
    rooms.push(b);

    await expect
      .poll(() => b.doc.getMap('e2e').get('hello'), { timeout: 10_000 })
      .toBe('gravity');
  });

  it('accepts the guest ?token= seam and records replay updates', async () => {
    const roomId = `e2e_replay_ws_${Date.now()}`;
    const client = await connectYjsRoom(roomId, { params: { token: 'e2e-guest-token' } });
    rooms.push(client);

    client.doc.getMap('canvas').set('marker', `v-${Date.now()}`);

    await expect
      .poll(
        async () => {
          const res = await apiJson<
            ApiSuccess<{ count: number; entries: Array<{ t: number; u: string }> }>
          >(`/api/v1/replay/${roomId}`);
          return res.body.data.count;
        },
        { timeout: 10_000 },
      )
      .toBeGreaterThan(0);

    const replay = await apiJson<
      ApiSuccess<{ room: string; count: number; entries: Array<{ t: number; u: string }> }>
    >(`/api/v1/replay/${roomId}`);
    expect(replay.status).toBe(200);
    expect(replay.body.data.room).toBe(roomId);
    expect(replay.body.data.entries[0]?.u).toBeTypeOf('string');
    expect(replay.body.data.entries[0]?.u.length).toBeGreaterThan(0);
  });
});
