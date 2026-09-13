import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

/**
 * Sets `requestId` from `X-Request-Id` or a new UUID, and echoes it on
 * the response. Logs and error envelopes include the same id.
 */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const id = req.header('x-request-id') ?? randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-Id', id);
  next();
}
