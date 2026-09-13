import { describe, expect, it } from 'vitest';
import { buildInviteEmail } from '../../src/services/email/invite-template';

describe('buildInviteEmail', () => {
  it('includes the call link in text and html when provided', () => {
    const { text, html } = buildInviteEmail({
      inviterName: 'Ada',
      roomTitle: 'Sprint board',
      roomUrl: 'https://example.com/rooms/abc',
      roomId: 'abc',
      callUrl: 'https://meet.google.com/abc-defg-hij',
    });
    expect(text).toContain('Join the live call: https://meet.google.com/abc-defg-hij');
    expect(html).toContain('Join call');
    expect(html).toContain('https://meet.google.com/abc-defg-hij');
  });

  it('omits call section when no callUrl', () => {
    const { text, html } = buildInviteEmail({
      inviterName: 'Ada',
      roomTitle: 'Sprint board',
      roomUrl: 'https://example.com/rooms/abc',
      roomId: 'abc',
    });
    expect(text).not.toContain('Join the live call');
    expect(html).not.toContain('Join call');
  });
});
