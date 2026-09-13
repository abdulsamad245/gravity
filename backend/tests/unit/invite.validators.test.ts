import { describe, expect, it } from 'vitest';
import { inviteBodySchema } from '../../src/validators/invite.validators';

const base = {
  emails: ['friend@example.com'],
  roomId: 'room_abcd',
  roomTitle: 'Demo',
  roomUrl: 'https://example.com/rooms/room_abcd',
  inviterName: 'Ada',
};

describe('inviteBodySchema', () => {
  it('accepts invites without a call link', () => {
    const parsed = inviteBodySchema.safeParse(base);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.callUrl).toBeUndefined();
    }
  });

  it('keeps a validated callUrl for the email template', () => {
    const parsed = inviteBodySchema.safeParse({
      ...base,
      callUrl: 'https://meet.google.com/abc-defg-hij',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.callUrl).toBe('https://meet.google.com/abc-defg-hij');
    }
  });

  it('strips invalid callUrl instead of failing the invite', () => {
    const parsed = inviteBodySchema.safeParse({
      ...base,
      callUrl: 'https://ewwefwefwe/',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.callUrl).toBeUndefined();
    }
  });

  it('rejects bad emails / room ids', () => {
    expect(inviteBodySchema.safeParse({ ...base, emails: ['not-an-email'] }).success).toBe(false);
    expect(inviteBodySchema.safeParse({ ...base, roomId: 'ab' }).success).toBe(false);
  });
});
