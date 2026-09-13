/**
 * Validates a user-supplied URL for on-canvas web embeds.
 * Uses shared public http(s) rules in http-url.ts.
 */

import { parsePublicHttpUrl, type PublicHttpUrlFailure } from './http-url';

export type EmbedUrlResult = { ok: true; href: string } | { ok: false; error: string };

/** Short, non-technical copy for the embed dialog. */
export const EMBED_URL_PROMPT =
  'Paste a link to a public website. It will appear on the board.';

function embedError(reason: PublicHttpUrlFailure): string {
  switch (reason) {
    case 'empty':
      return 'Add a website link to continue.';
    case 'too_long':
      return 'That link is too long. Try a shorter one.';
    case 'dangerous_scheme':
    case 'bad_protocol':
      return 'Use a normal website link (https://...).';
    case 'doubled_scheme':
      return 'That link looks broken (extra https://). Paste the URL once and try again.';
    case 'credentials':
      return 'Remove any username or password from the link, then try again.';
    case 'blocked_host':
      return 'That link cannot be embedded. Use a public website on the internet.';
    case 'malformed':
    default:
      return 'That does not look like a website link. Check for typos and try again.';
  }
}

/**
 * Normalize and validate an embed URL. Returns a canonical https?/http? href or an error message.
 */
export function validateEmbedUrl(raw: string): EmbedUrlResult {
  const parsed = parsePublicHttpUrl(raw);
  if (!parsed.ok) return { ok: false, error: embedError(parsed.reason) };
  return { ok: true, href: parsed.url.toString() };
}
