import { describe, expect, it } from 'vitest';
import { validateCallUrl } from './validate-call-url';

describe('validateCallUrl', () => {
  it('allows empty (optional clear)', () => {
    expect(validateCallUrl('')).toEqual({ ok: true, href: '' });
    expect(validateCallUrl('   ')).toEqual({ ok: true, href: '' });
  });

  it('accepts known call hosts and normalizes bare hosts to https', () => {
    expect(validateCallUrl('https://meet.google.com/abc-defg-hij')).toEqual({
      ok: true,
      href: 'https://meet.google.com/abc-defg-hij',
    });
    const zoom = validateCallUrl('zoom.us/j/123456789');
    expect(zoom.ok).toBe(true);
    if (zoom.ok) expect(zoom.href).toMatch(/^https:\/\/zoom\.us\/j\/123456789$/);

    expect(validateCallUrl('https://discord.gg/abcdef').ok).toBe(true);
    expect(validateCallUrl('https://us05web.zoom.us/j/1').ok).toBe(true);
    expect(validateCallUrl('https://teams.microsoft.com/l/meetup-join/x').ok).toBe(true);
  });

  it('rejects junk hosts, private nets, and dangerous schemes', () => {
    expect(validateCallUrl('https://ewwefwefwe/').ok).toBe(false);
    expect(validateCallUrl('https://example.com/meeting').ok).toBe(false);
    expect(validateCallUrl('javascript:alert(1)').ok).toBe(false);
    expect(validateCallUrl('https://127.0.0.1/call').ok).toBe(false);
    expect(validateCallUrl('https://192.168.1.10').ok).toBe(false);
    expect(validateCallUrl('https://localhost/meet').ok).toBe(false);
  });

  it('rejects doubled schemes from paste mistakes', () => {
    expect(validateCallUrl('https://https//meet.google.com/abc').ok).toBe(false);
    expect(validateCallUrl('https://https://zoom.us/j/1').ok).toBe(false);
  });
});
