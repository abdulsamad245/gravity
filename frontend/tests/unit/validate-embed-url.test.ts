import { describe, expect, it } from 'vitest';
import { validateEmbedUrl } from '../../src/shared/utils/validate-embed-url';

describe('validateEmbedUrl', () => {
  it('accepts public https URLs', () => {
    const result = validateEmbedUrl('https://example.com/path?q=1');
    expect(result).toEqual({ ok: true, href: 'https://example.com/path?q=1' });
  });

  it('adds https when the scheme is omitted', () => {
    const result = validateEmbedUrl('example.com/docs');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.href).toBe('https://example.com/docs');
  });

  it('rejects dangerous schemes and credentials', () => {
    expect(validateEmbedUrl('javascript:alert(1)').ok).toBe(false);
    expect(validateEmbedUrl('data:text/html,hi').ok).toBe(false);
    expect(validateEmbedUrl('https://user:pass@example.com').ok).toBe(false);
  });

  it('rejects loopback, private, and metadata targets', () => {
    expect(validateEmbedUrl('http://127.0.0.1/admin').ok).toBe(false);
    expect(validateEmbedUrl('http://localhost:3000').ok).toBe(false);
    expect(validateEmbedUrl('http://192.168.1.1').ok).toBe(false);
    expect(validateEmbedUrl('http://10.0.0.5').ok).toBe(false);
    expect(validateEmbedUrl('http://169.254.169.254/latest/meta-data').ok).toBe(false);
    expect(validateEmbedUrl('http://[::1]/').ok).toBe(false);
  });

  it('rejects doubled schemes like https://https//…', () => {
    expect(validateEmbedUrl('https://https//miro.com/signup/').ok).toBe(false);
    expect(validateEmbedUrl('https://https://example.com/path').ok).toBe(false);
  });
});
