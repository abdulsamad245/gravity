/**
 * Caller identity attached by auth middleware.
 * Guests today (`kind: 'guest'`). Future JWT auth can emit `kind: 'user'`
 * from the same middleware without changing Identity consumers.
 */
export interface Identity {
  kind: 'guest' | 'user';
  name: string;
  /** Stable id: client-generated for guests, account id for users. */
  id: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Correlation id attached by request-id middleware. */
      requestId: string;
      /** Resolved caller identity attached by auth middleware. */
      identity: Identity;
    }
  }
}
