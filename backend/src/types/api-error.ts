/**
 * Typed application error. Controllers and middleware throw these;
 * the central error middleware converts them into the
 * `{ error: { code, message, requestId, details? }, meta }` envelope.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
