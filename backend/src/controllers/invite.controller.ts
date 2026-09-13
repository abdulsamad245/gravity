import type { Request, Response, NextFunction } from 'express';
import { ApiResponse } from '../shared/http/api-response';
import { sendRoomInvites } from '../services/invite.service';
import type { InviteBody } from '../validators/invite.validators';

/** Enqueue room invite emails; inviter display name comes from `req.identity`. */
export async function postInvite(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as InviteBody;
    const inviter = req.identity?.name ?? 'A teammate';
    const data = await sendRoomInvites(body, inviter);
    ApiResponse.ok(res, data);
  } catch (err) {
    next(err);
  }
}
