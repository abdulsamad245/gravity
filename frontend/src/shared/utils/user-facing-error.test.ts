import { describe, expect, it } from 'vitest';
import { toUserFacingError } from './user-facing-error';

describe('toUserFacingError', () => {
  it('keeps friendly copy and attaches API text as details', () => {
    const face = toUserFacingError(new Error('Request failed: 503'), {
      title: 'Recording unavailable',
      message: 'We could not load this session recording.',
    });
    expect(face.title).toBe('Recording unavailable');
    expect(face.message).toBe('We could not load this session recording.');
    expect(face.details).toBe('Request failed: 503');
  });

  it('treats fetch TypeErrors as connection problems', () => {
    const face = toUserFacingError(new TypeError('Failed to fetch'), {
      title: 'Unavailable',
      message: 'Check your connection and try again.',
    });
    expect(face.message).toBe('Check your connection and try again.');
    expect(face.details).toBe('Failed to fetch');
  });

  it('omits details when there is no useful raw text', () => {
    const face = toUserFacingError(null, {
      title: 'Notice',
      message: 'Something went wrong.',
    });
    expect(face.message).toBe('Something went wrong.');
    expect(face.details).toBeUndefined();
  });
});
