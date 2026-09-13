import {
  ORBIT_MAX_PROMPT_CHARS,
  ORBIT_PROMPT_WARN_CHARS,
} from '../../shared/constants/orbit.constants';

/** Clamp composer text to the Orbit API prompt cap. */
export function clampOrbitPrompt(text: string): string {
  if (text.length <= ORBIT_MAX_PROMPT_CHARS) return text;
  return text.slice(0, ORBIT_MAX_PROMPT_CHARS);
}

/** True when the composer is at the hard character limit. */
export function isOrbitPromptAtLimit(text: string): boolean {
  return text.length >= ORBIT_MAX_PROMPT_CHARS;
}

/** Soft warning once the user is near the cap (still under maxLength). */
export function orbitPromptLimitMessage(text: string): string | null {
  if (text.length >= ORBIT_MAX_PROMPT_CHARS) {
    return `Messages are limited to ${ORBIT_MAX_PROMPT_CHARS.toLocaleString()} characters so Orbit stays stable.`;
  }
  if (text.length >= ORBIT_PROMPT_WARN_CHARS) {
    const left = ORBIT_MAX_PROMPT_CHARS - text.length;
    return `${left.toLocaleString()} character${left === 1 ? '' : 's'} left (max ${ORBIT_MAX_PROMPT_CHARS.toLocaleString()}).`;
  }
  return null;
}
