import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./boards', () => ({
  listBoards: vi.fn(() => []),
}));

vi.mock('../api/client', () => ({
  roomExists: vi.fn(async () => false),
}));

import { roomExists } from '../api/client';
import { listBoards } from './boards';
import { allocateUniqueRoomId, newRoomId, ROOM_ID_LENGTH } from './room-id';

describe('room-id', () => {
  beforeEach(() => {
    vi.mocked(listBoards).mockReturnValue([]);
    vi.mocked(roomExists).mockResolvedValue(false);
  });

  it('generates URL-safe ids of the configured length', () => {
    const id = newRoomId();
    expect(id).toHaveLength(ROOM_ID_LENGTH);
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('avoids ids already on the local board shelf', () => {
    const taken = 'AaBbCcDdEeFf';
    vi.mocked(listBoards).mockReturnValue([
      {
        id: taken,
        name: 'Taken',
        updatedAt: 1,
        openedAt: 1,
        starred: false,
        ownerName: 'You',
      },
    ]);
    const ids = new Set(Array.from({ length: 20 }, () => newRoomId()));
    expect(ids.has(taken)).toBe(false);
  });

  it('retries when the server reports the id exists', async () => {
    vi.mocked(roomExists)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    const id = await allocateUniqueRoomId();
    expect(id).toMatch(/^[A-Za-z0-9_-]{12,}$/);
    expect(roomExists).toHaveBeenCalledTimes(2);
  });
});
