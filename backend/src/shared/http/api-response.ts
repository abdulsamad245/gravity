import type { Response } from 'express';

/**
 * REST response envelope helpers. Controllers respond only through this class.
 *
 * Success:  { data, meta: { requestId, timestamp } }
 * Error:    { error: { code, message, requestId, details? }, meta }
 *
 * Shape is documented in OpenAPI.
 */
export class ApiResponse {
  static ok<T>(res: Response, data: T, status = 200): void {
    const requestId = res.req.requestId;
    res.status(status).json({
      data,
      meta: { requestId, timestamp: new Date().toISOString() },
    });
  }

  static created<T>(res: Response, data: T): void {
    ApiResponse.ok(res, data, 201);
  }

  static fail(
    res: Response,
    status: number,
    code: string,
    message: string,
    details?: unknown,
  ): void {
    const requestId = res.req.requestId;
    res.status(status).json({
      error: { code, message, requestId, ...(details !== undefined ? { details } : {}) },
      meta: { requestId, timestamp: new Date().toISOString() },
    });
  }
}
