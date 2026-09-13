/**
 * Validates a user-supplied external call link (Meet / Zoom / Discord / etc.).
 * Same shared public http(s) rules as embed URLs, plus a call-host allowlist.
 * Empty is allowed (optional field — clears the room call link).
 */

import { parsePublicHttpUrl, type PublicHttpUrlFailure } from './http-url';

/** Hosts (exact or suffix) we accept for “Join call”. */
const ALLOWED_CALL_HOSTS = [
  'meet.google.com',
  'zoom.us',
  'zoom.com',
  'discord.gg',
  'discord.com',
  'teams.microsoft.com',
  'teams.live.com',
  'whereby.com',
  'meet.jit.si',
  'webex.com',
  'skype.com',
] as const;

export type CallUrlResult = { ok: true; href: string } | { ok: false; error: string };

function isAllowedCallHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return ALLOWED_CALL_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

function callError(reason: PublicHttpUrlFailure): string {
  switch (reason) {
    case 'too_long':
      return 'That link is too long. Try a shorter one.';
    case 'dangerous_scheme':
    case 'bad_protocol':
      return 'Use a normal call link (https://...).';
    case 'doubled_scheme':
      return 'That link looks broken (extra https://). Paste the URL once and try again.';
    case 'credentials':
      return 'Remove any username or password from the link, then try again.';
    case 'blocked_host':
      return 'That link cannot be used. Paste a public Meet, Zoom, Discord, Teams, Whereby, Webex, Jitsi, or Skype link.';
    case 'empty':
    case 'malformed':
    default:
      return 'That does not look like a call link. Check for typos and try again.';
  }
}

/**
 * Normalize and validate a call URL. Empty string → ok with empty href (clear).
 */
export function validateCallUrl(raw: string): CallUrlResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: true, href: '' };

  const parsed = parsePublicHttpUrl(trimmed);
  if (!parsed.ok) return { ok: false, error: callError(parsed.reason) };

  if (!isAllowedCallHost(parsed.url.hostname)) {
    return {
      ok: false,
      error: 'Use a Meet, Zoom, Discord, Teams, Whereby, Webex, Jitsi, or Skype link.',
    };
  }

  // Prefer https for call joins.
  if (parsed.url.protocol === 'http:') {
    parsed.url.protocol = 'https:';
  }

  return { ok: true, href: parsed.url.toString() };
}
