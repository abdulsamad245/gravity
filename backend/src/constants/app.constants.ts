/**
 * Resolved app settings (env with defaults from app.defaults.ts).
 *
 * Product display name on the backend (Swagger, logs, invite copy). Frontend
 * still has its own `APP_NAME` constant. Rename the product in both places
 * (or set `APP_NAME` in env for the backend only).
 *
 * Path prefixes (`API_PREFIX`, `API_DOCS_PATH`, `WS_PATH_PREFIX`) must stay
 * aligned with the frontend Vite proxy and Docker Nginx locations if changed.
 */
import { config } from '../config/config';

export const APP_NAME = config.APP_NAME;

export const API_PREFIX = config.API_PREFIX;

export const API_DOCS_PATH = config.API_DOCS_PATH;

/**
 * Valid room names: URL-safe nanoid alphabet, 4-64 chars by default.
 * Applied to both WebSocket upgrades and REST params.
 */
export const ROOM_NAME_REGEX = config.ROOM_NAME_REGEX;

/** WebSocket path prefix stripped before resolving the room name. */
export const WS_PATH_PREFIX = config.WS_PATH_PREFIX;

/** Hard cap on replay-log entries per room (memory guard). */
export const REPLAY_LOG_MAX_ENTRIES = config.REPLAY_LOG_MAX_ENTRIES;

/** Coalesce active-room snapshots while still limiting crash exposure. */
export const ROOM_PERSIST_DEBOUNCE_MS = config.ROOM_PERSIST_DEBOUNCE_MS;

/** Rate limit for the REST API (per IP). */
export const RATE_LIMIT = {
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX,
} as const;
