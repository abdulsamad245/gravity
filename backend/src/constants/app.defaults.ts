/**
 * Compile-time defaults for app settings. Overridable via env (see config.ts).
 * Keep path/name defaults aligned with root/backend `.env.example` and
 * docker-compose.yml. `ROOM_NAME_REGEX` is code-defaulted only (optional env
 * override; omit from Compose inline defaults — `{…}` braces break substitution).
 */
export const APP_DEFAULTS = {
  APP_NAME: 'Gravity',
  API_PREFIX: '/api/v1',
  API_DOCS_PATH: '/api/docs',
  /** Source pattern string; compiled to RegExp after env parse. */
  ROOM_NAME_REGEX: '^[A-Za-z0-9_-]{4,64}$',
  WS_PATH_PREFIX: '/ws',
  REPLAY_LOG_MAX_ENTRIES: 100_000,
  ROOM_PERSIST_DEBOUNCE_MS: 1_000,
  RATE_LIMIT_WINDOW_MS: 60_000,
  RATE_LIMIT_MAX: 300,
} as const;
