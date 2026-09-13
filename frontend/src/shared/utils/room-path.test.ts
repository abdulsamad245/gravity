import { describe, expect, it } from 'vitest';
import { parseRoomIdFromInput, roomPath } from './room-path';

describe('room-path', () => {
  it('builds the canonical collection path', () => {
    expect(roomPath('NjjTtYlm')).toBe('/rooms/NjjTtYlm');
  });

  it('parses canonical and legacy invite links', () => {
    expect(parseRoomIdFromInput('http://localhost:5173/rooms/NjjTtYlm')).toBe('NjjTtYlm');
    expect(parseRoomIdFromInput('http://localhost:5173/room/NjjTtYlm')).toBe('NjjTtYlm');
    expect(parseRoomIdFromInput('/rooms/abc_123-X')).toBe('abc_123-X');
    expect(parseRoomIdFromInput('NjjTtYlm')).toBe('NjjTtYlm');
  });

  it('rejects junk join input', () => {
    expect(parseRoomIdFromInput('')).toBeNull();
    expect(parseRoomIdFromInput('ab')).toBeNull(); // too short for a room code
    expect(parseRoomIdFromInput('not a code!')).toBeNull();
    expect(parseRoomIdFromInput('http://localhost:5173/rooms')).toBeNull();
  });
});
