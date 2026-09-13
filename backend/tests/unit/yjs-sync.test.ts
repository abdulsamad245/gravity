import { describe, expect, it } from 'vitest';
import { parseRoomName } from '../../src/sockets/yjs-sync';

describe('parseRoomName', () => {
  it('extracts the room from a plain path', () => {
    expect(parseRoomName('/myroom01')).toBe('myroom01');
  });

  it('strips the /ws prefix used behind the Nginx proxy', () => {
    expect(parseRoomName('/ws/myroom01')).toBe('myroom01');
  });

  it('ignores query strings', () => {
    expect(parseRoomName('/myroom01?token=abc')).toBe('myroom01');
  });

  it('rejects names that are too short, too long, or contain bad characters', () => {
    expect(parseRoomName('/ab')).toBeNull();
    expect(parseRoomName('/' + 'a'.repeat(65))).toBeNull();
    expect(parseRoomName('/bad room')).toBeNull();
    expect(parseRoomName('/bad/room')).toBeNull();
  });
});
