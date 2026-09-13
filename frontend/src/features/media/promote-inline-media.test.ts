import { describe, expect, it } from 'vitest';
import { MEDIA_API_PATH } from '../../shared/constants/app.constants';
import { isInlineDataUrl, mimeFromDataUrl } from './inline-data-url';

describe('inline data URL helpers', () => {
  it('detects data URLs', () => {
    expect(isInlineDataUrl('data:image/png;base64,abc')).toBe(true);
    expect(isInlineDataUrl(`${MEDIA_API_PATH}/abc.png`)).toBe(false);
    expect(isInlineDataUrl(undefined)).toBe(false);
  });

  it('reads mime from data URLs', () => {
    expect(mimeFromDataUrl('data:image/jpeg;base64,abc')).toBe('image/jpeg');
    expect(mimeFromDataUrl('data:audio/webm;codecs=opus;base64,abc')).toBe('audio/webm');
  });
});
