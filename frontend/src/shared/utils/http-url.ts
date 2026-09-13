/**
 * Shared public http(s) URL checks used by embed + call link validators.
 * Client-side only: no fetch (avoids classic server SSRF).
 */

export const HTTP_URL_MAX_LENGTH = 2048;

const BLOCKED_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
  'metadata.goog',
  'metadata',
  'kubernetes.default',
  'kubernetes.default.svc',
]);

const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.intranet', '.lan', '.home', '.corp'];

const DANGEROUS_SCHEMES = [
  'javascript:',
  'data:',
  'blob:',
  'file:',
  'vbscript:',
  'about:',
] as const;

export type PublicHttpUrlFailure =
  | 'empty'
  | 'too_long'
  | 'dangerous_scheme'
  | 'doubled_scheme'
  | 'malformed'
  | 'bad_protocol'
  | 'credentials'
  | 'blocked_host';

export type PublicHttpUrlResult =
  | { ok: true; url: URL }
  | { ok: false; reason: PublicHttpUrlFailure };

function parseIpv4(host: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  const parts = [m[1], m[2], m[3], m[4]].map((p) => Number(p));
  if (parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  return parts;
}

function isBlockedIpv4(parts: number[]): boolean {
  const [a, b] = parts;
  if (a === 0) return true;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function isBlockedIpv6(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === '::1' || h === '::' || h === '0:0:0:0:0:0:0:1') return true;
  if (h.startsWith('fc') || h.startsWith('fd')) return true;
  if (h.startsWith('fe8') || h.startsWith('fe9') || h.startsWith('fea') || h.startsWith('feb')) {
    return true;
  }
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(h);
  if (mapped) {
    const parts = parseIpv4(mapped[1]!);
    if (parts && isBlockedIpv4(parts)) return true;
  }
  return false;
}

export function isBlockedHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, '');
  if (!host) return true;
  if (BLOCKED_HOSTS.has(host)) return true;
  if (BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;

  const ipv4 = parseIpv4(host);
  if (ipv4 && isBlockedIpv4(ipv4)) return true;
  if (host.includes(':') && isBlockedIpv6(host)) return true;

  return false;
}

/** Paste on top of a prefilled `https://` → `https://https://…` / `https://https//…`. */
export function hasDoubledHttpScheme(raw: string): boolean {
  const trimmed = raw.trim();
  return /^https?:\/\/https?/i.test(trimmed) || /^https?:[^/]/i.test(trimmed);
}

/**
 * Parse + apply the shared public http(s) rules.
 * Callers map `reason` to product copy (embed vs call).
 */
export function parsePublicHttpUrl(raw: string): PublicHttpUrlResult {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, reason: 'empty' };
  if (trimmed.length > HTTP_URL_MAX_LENGTH) return { ok: false, reason: 'too_long' };

  const lower = trimmed.toLowerCase();
  if (DANGEROUS_SCHEMES.some((scheme) => lower.startsWith(scheme))) {
    return { ok: false, reason: 'dangerous_scheme' };
  }

  if (hasDoubledHttpScheme(trimmed)) {
    return { ok: false, reason: 'doubled_scheme' };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
  } catch {
    return { ok: false, reason: 'malformed' };
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return { ok: false, reason: 'bad_protocol' };
  }

  if (parsed.username || parsed.password) {
    return { ok: false, reason: 'credentials' };
  }

  // Scheme leftovers that URL() still accepts as a hostname (`https://https`).
  const host = parsed.hostname.toLowerCase();
  if (host === 'http' || host === 'https') {
    return { ok: false, reason: 'doubled_scheme' };
  }

  if (isBlockedHostname(parsed.hostname)) {
    return { ok: false, reason: 'blocked_host' };
  }

  parsed.hash = '';
  return { ok: true, url: parsed };
}
