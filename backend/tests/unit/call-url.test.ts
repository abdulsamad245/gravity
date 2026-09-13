import { describe, expect, it } from 'vitest';
import { normalizeOptionalCallUrl } from '../../src/validators/call-url';

describe('normalizeOptionalCallUrl', () => {
  it('returns undefined for empty or missing values', () => {
    expect(normalizeOptionalCallUrl(undefined)).toBeUndefined();
    expect(normalizeOptionalCallUrl(null)).toBeUndefined();
    expect(normalizeOptionalCallUrl('')).toBeUndefined();
    expect(normalizeOptionalCallUrl('   ')).toBeUndefined();
  });

  it('accepts known call hosts and upgrades http to https', () => {
    expect(normalizeOptionalCallUrl('https://meet.google.com/abc-defg-hij')).toBe(
      'https://meet.google.com/abc-defg-hij',
    );
    expect(normalizeOptionalCallUrl('http://zoom.us/j/123')).toBe('https://zoom.us/j/123');
    expect(normalizeOptionalCallUrl('discord.gg/abcdef')).toBe('https://discord.gg/abcdef');
    expect(normalizeOptionalCallUrl('https://us05web.zoom.us/j/1')).toMatch(
      /^https:\/\/us05web\.zoom\.us\/j\/1$/,
    );
  });

  it('rejects junk hosts and private targets', () => {
    expect(normalizeOptionalCallUrl('https://ewwefwefwe/')).toBeUndefined();
    expect(normalizeOptionalCallUrl('https://example.com/meet')).toBeUndefined();
    expect(normalizeOptionalCallUrl('javascript:alert(1)')).toBeUndefined();
    expect(normalizeOptionalCallUrl('https://127.0.0.1/call')).toBeUndefined();
  });

  it('rejects doubled schemes from paste mistakes', () => {
    expect(normalizeOptionalCallUrl('https://https//meet.google.com/abc')).toBeUndefined();
    expect(normalizeOptionalCallUrl('https://https://zoom.us/j/1')).toBeUndefined();
  });
});
