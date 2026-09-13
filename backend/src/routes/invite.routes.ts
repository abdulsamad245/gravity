import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { INVITE_RATE_LIMIT } from '../constants/invite.constants';
import { postInvite } from '../controllers/invite.controller';
import { validateBody } from '../middleware/validate.middleware';
import { inviteBodySchema } from '../validators/invite.validators';

export const inviteRouter = Router();

const inviteLimiter = rateLimit({
  ...INVITE_RATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many invites. Try again shortly.' } },
});

/**
 * @openapi
 * /api/v1/invite:
 *   post:
 *     summary: Queue room invite emails (SMTP background delivery)
 *     description: >
 *       Accepts invite emails with the room link and enqueues them for
 *       background SMTP delivery (retries + concurrency). When `callUrl` is a
 *       validated Meet / Zoom / Discord / Teams / Whereby / Webex / Jitsi /
 *       Skype URL, the email also includes a Join call section. Without SMTP
 *       credentials the API still returns success with mode=deferred and logs
 *       the batch. With SMTP configured, mode=queued and the HTTP response
 *       does not wait for the provider.
 *     tags: [Invite]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/InviteRequest'
 *     responses:
 *       200:
 *         description: Invites accepted (delivery failures are logged server-side)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [data, meta]
 *               properties:
 *                 data: { $ref: '#/components/schemas/InviteData' }
 *                 meta: { $ref: '#/components/schemas/Meta' }
 *       400:
 *         description: Invalid request body
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       429:
 *         description: Rate limited
 */
inviteRouter.post('/invite', inviteLimiter, validateBody(inviteBodySchema), postInvite);
