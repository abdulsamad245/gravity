import { describe, expect, it } from 'vitest';
import { ApiError } from '../../types/api-error';
import { parseDataUrl } from './parse-data-url';

describe('parseDataUrl', () => {
  it('parses a plain image data URL', () => {
    const bytes = Buffer.from('hi');
    const parsed = parseDataUrl(`data:image/png;base64,${bytes.toString('base64')}`);
    expect(parsed.mimeType).toBe('image/png');
    expect(parsed.bytes.equals(bytes)).toBe(true);
  });

  it('parses MediaRecorder voice notes with codecs params', () => {
    const bytes = Buffer.from([1, 2, 3, 4]);
    const parsed = parseDataUrl(`data:audio/webm;codecs=opus;base64,${bytes.toString('base64')}`);
    expect(parsed.mimeType).toBe('audio/webm');
    expect(parsed.bytes.equals(bytes)).toBe(true);
  });

  it('rejects non-data URLs', () => {
    expect(() => parseDataUrl('https://example.com/a.webm')).toThrow(ApiError);
  });
});
