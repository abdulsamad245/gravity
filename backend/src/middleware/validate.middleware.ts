import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { ApiError } from '../types/api-error';

/**
 * Generic request validator (system-boundary rule: every HTTP input is
 * validated before reaching a controller). Produces a 400 with structured
 * details on failure; on success, replaces the target with parsed data.
 */
export function validateParams(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      next(new ApiError(400, 'VALIDATION_ERROR', 'Invalid request parameters', result.error.issues));
      return;
    }
    req.params = result.data as Request['params'];
    next();
  };
}

/** Same boundary rule as `validateParams`: replace `req.body` with the Zod parse result. */
export function validateBody(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new ApiError(400, 'VALIDATION_ERROR', 'Invalid request body', result.error.issues));
      return;
    }
    req.body = result.data;
    next();
  };
}
