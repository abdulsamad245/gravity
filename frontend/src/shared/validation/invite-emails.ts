import { z } from 'zod';

/** Max recipients — keep aligned with backend `INVITE_MAX_RECIPIENTS`. */
export const INVITE_MAX_RECIPIENTS = 20;

const inviteEmailSchema = z.string().trim().email().max(254);

export type InviteEmailsResult =
  | { ok: true; emails: string[] }
  | { ok: false; error: string };

/** Split a paste field and validate each address with Zod (same rules family as the API). */
export function parseInviteEmails(raw: string): InviteEmailsResult {
  const parts = [
    ...new Set(
      raw
        .split(/[\s,;]+/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];

  if (parts.length === 0) {
    return { ok: false, error: 'Add at least one email address.' };
  }
  if (parts.length > INVITE_MAX_RECIPIENTS) {
    return {
      ok: false,
      error: `You can invite up to ${INVITE_MAX_RECIPIENTS} people at once.`,
    };
  }

  const invalid = parts.filter((email) => !inviteEmailSchema.safeParse(email).success);
  if (invalid.length) {
    return {
      ok: false,
      error:
        invalid.length === 1
          ? `"${invalid[0]}" is not a valid email. Use a full address like name@example.com.`
          : `These do not look like valid emails: ${invalid.join(', ')}`,
    };
  }

  return { ok: true, emails: parts };
}
