/**
 * Product name — also the Logo wordmark. Rename here (and the backend
 * counterpart) and the mark + text lockup updates everywhere.
 */
export const APP_NAME = 'Gravity';

/** In-board assistant shown in the right dock. */
export const ASSISTANT_NAME = 'Orbit';

export const APP_TAGLINE = 'Ideas with mass. Rooms that move.';

export const APP_SUPPORT =
  'Throw stickies, rope shapes together, and work live. Offline when you need it. Replay when you want the story back.';

function envOr(key: string, fallback: string): string {
  const v = (import.meta.env[key] as string | undefined)?.trim();
  return v && v.length > 0 ? v : fallback;
}

/** Same-origin defaults: Vite proxies /api+/ws in DEV; Nginx does in Docker/prod. */
const defaultWs =
  typeof window !== 'undefined' && window.location?.host
    ? `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}/ws`
    : 'ws://localhost/ws';
const defaultApi = '';

/**
 * Backend endpoints. Overridable via VITE_WS_URL / VITE_API_URL.
 * Prefer same-origin (empty API base) so board media embeds are not cross-origin.
 */
export const WS_BASE_URL = envOr('VITE_WS_URL', defaultWs);
export const API_BASE_URL = envOr('VITE_API_URL', defaultApi);

/** REST mount; keep in sync with backend `API_PREFIX` / Nginx `/api/`. */
export const API_PREFIX = '/api/v1';

/** Durable media path prefix (`/api/v1/media/...`). */
export const MEDIA_API_PATH = `${API_PREFIX}/media`;

/** Build-time gate for Orbit UI; the server still needs `LLM_API_KEY` to answer. */
export const AI_ENABLED = String(import.meta.env.VITE_AI_ENABLED ?? 'false') === 'true';
