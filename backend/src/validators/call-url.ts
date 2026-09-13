/**
 * Boundary check for optional invite call links.
 * Mirrors frontend allowlist (Meet / Zoom / Discord / Teams / …).
 */

const MAX_URL_LENGTH = 2_048;

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

function isAllowedCallHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  return ALLOWED_CALL_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

/** Returns canonical https href, or null if empty/invalid (optional field). */
export function normalizeOptionalCallUrl(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > MAX_URL_LENGTH) return undefined;

  // Same paste-mistake guard as frontend http-url / validate-call-url.
  if (/^https?:\/\/https?/i.test(trimmed) || /^https?:[^/]/i.test(trimmed)) {
    return undefined;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
  } catch {
    return undefined;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return undefined;
  if (parsed.username || parsed.password) return undefined;
  const host = parsed.hostname.toLowerCase();
  if (host === 'http' || host === 'https') return undefined;
  if (!isAllowedCallHost(parsed.hostname)) return undefined;

  parsed.protocol = 'https:';
  parsed.hash = '';
  return parsed.toString();
}
