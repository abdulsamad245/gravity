import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../types/api-error';
import { logger } from '../observability/logger';
import { captureException } from '../observability/sentry';
import { ApiResponse } from '../shared/http/api-response';

/**
 * Central error handler. The only place error responses are produced.
 * Uses the same ApiResponse envelope as success paths.
 */
export function errorMiddleware(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const requestId = req.requestId;

  if (err instanceof ApiError) {
    if (err.status >= 500) {
      logger.error({ err, requestId }, err.message);
      captureException(err, { requestId });
    } else {
      logger.warn({ code: err.code, requestId }, err.message);
    }
    ApiResponse.fail(res, err.status, err.code, err.message, err.details);
    return;
  }

  logger.error({ err, requestId }, 'Unhandled error');
  captureException(err, { requestId });
  ApiResponse.fail(res, 500, 'INTERNAL_ERROR', 'Internal server error');
}
