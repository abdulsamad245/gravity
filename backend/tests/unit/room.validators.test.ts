import { describe, expect, it } from 'vitest';
import { roomParamsSchema } from '../../src/validators/room.validators';

describe('roomParamsSchema', () => {
  it('accepts URL-safe room ids', () => {
    expect(roomParamsSchema.safeParse({ room: 'Ab1_-xyz' }).success).toBe(true);
  });

  it('rejects invalid room ids', () => {
    for (const room of ['ab', 'has space', 'emoji💥', 'a'.repeat(65)]) {
      expect(roomParamsSchema.safeParse({ room }).success).toBe(false);
    }
  });
});
