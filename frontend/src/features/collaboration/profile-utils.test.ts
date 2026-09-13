import { describe, expect, it } from 'vitest';
import { shouldShowAvatarColorPicker } from './profile-utils';

describe('shouldShowAvatarColorPicker', () => {
  it('shows color picker for initials avatars', () => {
    expect(shouldShowAvatarColorPicker(undefined)).toBe(true);
    expect(shouldShowAvatarColorPicker(null)).toBe(true);
    expect(shouldShowAvatarColorPicker('')).toBe(true);
  });

  it('hides color picker when a photo is set', () => {
    expect(shouldShowAvatarColorPicker('data:image/png;base64,abc')).toBe(false);
  });
});
