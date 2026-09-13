/**
 * Orbit composer + API payload caps.
 * Keep in sync with backend/src/constants/llm.constants.ts (gpt-4o-mini sized).
 */
export const ORBIT_MAX_PROMPT_CHARS = 2_000;
export const ORBIT_MAX_HISTORY_MESSAGES = 10;
export const ORBIT_MAX_HISTORY_CHARS = 600;
export const ORBIT_MAX_BOARD_ITEMS = 80;
export const ORBIT_MAX_CONTEXT_ITEMS = 24;
/** Warn in the composer when the user is near the hard cap. */
export const ORBIT_PROMPT_WARN_CHARS = 1_800;
