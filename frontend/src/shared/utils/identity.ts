import { nanoid } from 'nanoid';
import { USER_COLORS } from '../constants/colors.constants';
import type { Identity } from '../types';
import { rememberDeviceUsername } from './username';

const SESSION_KEY = 'gravity.identity.session';
const LAST_NAME_KEY = 'gravity.lastName';
/** Legacy localStorage key that once held the full identity (id + avatar). Remove only. */
const LEGACY_IDENTITY_KEY = 'gravity.identity';

/** Deterministic color from a username. Same username maps to the same color. */
export function colorForName(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return USER_COLORS[Math.abs(h) % USER_COLORS.length];
}

function purgeLegacyIdentityMirror(): void {
  try {
    localStorage.removeItem(LEGACY_IDENTITY_KEY);
  } catch {
    /* private mode */
  }
}

/** Prefill helper: last used username on this browser (not the full identity). */
export function loadLastName(): string {
  try {
    return localStorage.getItem(LAST_NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

/**
 * Loads the guest identity for THIS TAB only (sessionStorage).
 * A second person on the same device opening a new tab gets a fresh prompt.
 */
export function loadIdentity(): Identity | null {
  purgeLegacyIdentityMirror();
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Identity) : null;
  } catch {
    return null;
  }
}

/**
 * Creates or updates the guest identity for this tab.
 * Pass `color` to set avatar color; omit it to keep the existing color (or derive on first create).
 * Pass `avatar` as a data URL to set a photo, `null` to clear, or omit to keep the existing photo.
 *
 * Persists only to sessionStorage (tab-scoped). localStorage keeps the username for prefill —
 * never the id, color, or avatar (those are XSS-readable if mirrored into durable storage).
 * Usernames are also registered device-wide so auto-generate can avoid clashes across tabs.
 */
export function saveIdentity(name: string, color?: string, avatar?: string | null): Identity {
  const existing = loadIdentity();
  let nextAvatar: string | undefined;
  if (avatar === null) nextAvatar = undefined;
  else if (typeof avatar === 'string') nextAvatar = avatar || undefined;
  else nextAvatar = existing?.avatar;

  const identity: Identity = {
    kind: 'guest',
    name,
    id: existing?.id ?? nanoid(12),
    color: color ?? existing?.color ?? colorForName(name),
    ...(nextAvatar ? { avatar: nextAvatar } : {}),
  };
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(identity));
    localStorage.setItem(LAST_NAME_KEY, name);
    rememberDeviceUsername(name);
    purgeLegacyIdentityMirror();
  } catch {
    /* private mode: still return in-memory identity */
  }
  return identity;
}
