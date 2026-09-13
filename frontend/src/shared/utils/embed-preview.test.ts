import { describe, expect, it } from 'vitest';
import { extractVimeoId, extractYoutubeId, planEmbedPreview } from './embed-preview';

describe('embed-preview', () => {
  it('extracts YouTube ids', () => {
    expect(extractYoutubeId(new URL('https://www.youtube.com/watch?v=dQw4w9WgXcQ'))).toBe(
      'dQw4w9WgXcQ',
    );
    expect(extractYoutubeId(new URL('https://youtu.be/dQw4w9WgXcQ'))).toBe('dQw4w9WgXcQ');
    expect(extractYoutubeId(new URL('https://www.youtube.com/shorts/dQw4w9WgXcQ'))).toBe(
      'dQw4w9WgXcQ',
    );
  });

  it('extracts Vimeo ids', () => {
    expect(extractVimeoId(new URL('https://vimeo.com/123456789'))).toBe('123456789');
    expect(extractVimeoId(new URL('https://player.vimeo.com/video/123456789'))).toBe('123456789');
  });

  it('plans YouTube as nocookie iframe', () => {
    const plan = planEmbedPreview('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(plan.mode).toBe('iframe');
    if (plan.mode === 'iframe') {
      expect(plan.iframeSrc).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
    }
  });

  it('plans generic URLs as an iframe attempt (UI may fall back to link)', () => {
    const plan = planEmbedPreview('https://example.com/docs');
    expect(plan.mode).toBe('iframe');
    if (plan.mode === 'iframe') {
      expect(plan.iframeSrc).toContain('example.com/docs');
      expect(plan.host).toBe('example.com');
    }
  });
});
