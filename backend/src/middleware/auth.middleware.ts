import type { NextFunction, Request, Response } from 'express';
import type { Identity } from '../types/identity';

/**
 * Auth middleware (`AUTH_MODE=guest`).
 * Resolves a guest Identity from optional `x-guest-*` headers.
 * JWT verification belongs here when `kind: 'user'` is added.
 */
export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  // Guest mode never rejects: always attach an Identity so controllers can read req.identity.
  const name = req.header('x-guest-name')?.slice(0, 40) || 'anonymous';
  const id = req.header('x-guest-id')?.slice(0, 64) || 'guest';
  const identity: Identity = { kind: 'guest', name, id };
  req.identity = identity;
  next();
}
