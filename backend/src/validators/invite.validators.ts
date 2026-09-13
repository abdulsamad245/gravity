import { z } from 'zod';
import { INVITE_MAX_RECIPIENTS } from '../constants/invite.constants';
import { normalizeOptionalCallUrl } from './call-url';

export const inviteBodySchema = z.object({
  emails: z.array(z.string().email().max(254)).min(1).max(INVITE_MAX_RECIPIENTS),
  roomId: z.string().min(4).max(64),
  roomTitle: z.string().min(1).max(120).default('Untitled room'),
  roomUrl: z.string().url().max(2_000),
  inviterName: z.string().min(1).max(80).optional(),
  /** Optional Meet / Zoom / Discord (etc.) link included in the invite email. */
  callUrl: z
    .string()
    .max(2_048)
    .optional()
    .transform((v) => normalizeOptionalCallUrl(v)),
});

export type InviteBody = z.infer<typeof inviteBodySchema>;
