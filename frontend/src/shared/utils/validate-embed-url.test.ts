import { describe, expect, it } from 'vitest';
import { validateEmbedUrl } from './validate-embed-url';

describe('validateEmbedUrl', () => {
  it('accepts public https sites and normalizes bare hosts', () => {
    expect(validateEmbedUrl('https://example.com/docs')).toEqual({
      ok: true,
      href: 'https://example.com/docs',
    });
    const bare = validateEmbedUrl('example.com');
    expect(bare.ok).toBe(true);
    if (bare.ok) expect(bare.href).toMatch(/^https:\/\/example\.com\/?$/);
  });

  it('rejects empty, dangerous schemes, and private hosts', () => {
    expect(validateEmbedUrl('').ok).toBe(false);
    expect(validateEmbedUrl('javascript:alert(1)').ok).toBe(false);
    expect(validateEmbedUrl('http://127.0.0.1/admin').ok).toBe(false);
    expect(validateEmbedUrl('https://192.168.1.10').ok).toBe(false);
    expect(validateEmbedUrl('https://localhost:3000').ok).toBe(false);
  });

  it('rejects doubled or mangled schemes from paste mistakes', () => {
    const doubled = validateEmbedUrl('https://https//miro.com/signup/');
    expect(doubled.ok).toBe(false);
    if (!doubled.ok) expect(doubled.error).toMatch(/extra https/i);

    expect(validateEmbedUrl('https://https://example.com').ok).toBe(false);
    expect(validateEmbedUrl('https://https').ok).toBe(false);
  });
});
