import { describe, expect, it } from 'vitest';
import { ORBIT_MAX_PROMPT_CHARS, ORBIT_PROMPT_WARN_CHARS } from '../../shared/constants/orbit.constants';
import { clampOrbitPrompt, isOrbitPromptAtLimit, orbitPromptLimitMessage } from './orbit-limits';

describe('Orbit prompt limits', () => {
  it('clamps text to the LLM-safe prompt cap', () => {
    const huge = 'a'.repeat(ORBIT_MAX_PROMPT_CHARS + 50);
    expect(clampOrbitPrompt(huge)).toHaveLength(ORBIT_MAX_PROMPT_CHARS);
  });

  it('reports at-limit only at the hard cap', () => {
    expect(isOrbitPromptAtLimit('a'.repeat(ORBIT_MAX_PROMPT_CHARS - 1))).toBe(false);
    expect(isOrbitPromptAtLimit('a'.repeat(ORBIT_MAX_PROMPT_CHARS))).toBe(true);
  });

  it('warns near the cap and errors at the cap', () => {
    expect(orbitPromptLimitMessage('short')).toBeNull();
    expect(orbitPromptLimitMessage('a'.repeat(ORBIT_PROMPT_WARN_CHARS))).toMatch(/left/i);
    expect(orbitPromptLimitMessage('a'.repeat(ORBIT_MAX_PROMPT_CHARS))).toMatch(/limited/i);
  });
});
