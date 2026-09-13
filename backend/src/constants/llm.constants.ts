/** Per-IP Orbit rate limit; keep aligned with orbit route middleware. */
export const LLM_RATE_LIMIT = { windowMs: 60_000, max: 20 } as const;

/**
 * Payload caps sized for gpt-4o-mini (large context) while keeping requests
 * small enough that Express JSON (3mb), Zod, and the provider call stay stable.
 * Keep in sync with frontend/src/shared/constants/orbit.constants.ts and
 * frontend/src/shared/constants/media.constants.ts (ORBIT_MAX_*).
 */
export const LLM_MAX_PROMPT_CHARS = 2_000;
export const LLM_MAX_CONTEXT_ITEMS = 24;
export const LLM_MAX_BOARD_ITEMS = 80;
export const LLM_MAX_ATTACHMENTS = 4;
/** Max extracted document text per attachment (chars). */
export const LLM_MAX_ATTACHMENT_TEXT = 8_000;
/** Cap total extracted text across all attachments in one turn. */
export const LLM_MAX_TOTAL_ATTACHMENT_TEXT = 16_000;
/** Max attachment file size accepted on the Orbit API (bytes). */
export const LLM_MAX_ATTACHMENT_BYTES = 1 * 1024 * 1024;
/** Prior turns sent with each Orbit request (user + assistant pairs). */
export const LLM_MAX_HISTORY_MESSAGES = 10;
export const LLM_MAX_HISTORY_CHARS = 600;
export const LLM_MAX_REPLY_CHARS = 8_000;
export const LLM_DEFAULT_MODEL = 'gpt-4o-mini';
export const LLM_DEFAULT_BASE_URL = 'https://api.openai.com/v1';
export const LLM_DEFAULT_TIMEOUT_MS = 45_000;
/** Whisper (or compatible) model for Orbit voice-note transcription. */
export const LLM_DEFAULT_TRANSCRIBE_MODEL = 'whisper-1';
/** Room for short chat + a board-ops JSON fence. */
export const LLM_MAX_TOKENS = 2_200;
