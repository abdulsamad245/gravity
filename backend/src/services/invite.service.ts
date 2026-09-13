import { config } from '../config/config';
import type { InviteResponseDto } from '../dto/invite.dto';
import { logger } from '../observability/logger';
import type { InviteBody } from '../validators/invite.validators';
import { emailQueue } from './email/email-queue';
import { buildInviteEmail } from './email/invite-template';

/** Prefer APP_PUBLIC_URL for invite links when set; otherwise the client roomUrl. */
function inviteRoomUrl(roomId: string, fallbackRoomUrl: string): string {
  const base = config.APP_PUBLIC_URL?.replace(/\/$/, '');
  if (!base) return fallbackRoomUrl;
  return `${base}/rooms/${encodeURIComponent(roomId)}`;
}

/**
 * Accept room invites and enqueue outbound mail.
 * Returns immediately; delivery is BullMQ/Redis or in-memory + SMTP.
 */
export async function sendRoomInvites(
  body: InviteBody,
  fallbackInviterName: string,
): Promise<InviteResponseDto> {
  const inviterName = (body.inviterName?.trim() || fallbackInviterName || 'A teammate').slice(0, 80);
  const model = {
    inviterName,
    roomTitle: body.roomTitle,
    roomUrl: inviteRoomUrl(body.roomId, body.roomUrl),
    roomId: body.roomId,
    callUrl: body.callUrl,
  };
  const content = buildInviteEmail(model);

  const mode: InviteResponseDto['mode'] = config.inviteEmailConfigured ? 'queued' : 'deferred';
  let accepted = 0;

  for (const to of body.emails) {
    const ok = emailQueue.enqueue(
      {
        to,
        subject: content.subject,
        text: content.text,
        html: content.html,
      },
      { kind: 'invite', roomId: body.roomId },
    );
    if (ok) accepted += 1;
  }

  logger.info(
    {
      event: 'invite_batch',
      mode,
      accepted,
      requested: body.emails.length,
      roomId: body.roomId,
      smtpConfigured: config.inviteEmailConfigured,
      queuePending: emailQueue.pendingCount,
      queueActive: emailQueue.activeCount,
    },
    'Invite batch enqueued',
  );

  return { ok: true, accepted, mode };
}
