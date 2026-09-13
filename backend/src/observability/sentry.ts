import * as Sentry from '@sentry/node';
import { config } from '../config/config';
import { logger } from './logger';

let enabled = false;

/**
 * Initializes Sentry error monitoring — only when SENTRY_DSN is configured.
 * The application runs identically without it.
 */
export function initSentry(): void {
  if (!config.SENTRY_DSN) {
    logger.info('Sentry disabled (no SENTRY_DSN configured)');
    return;
  }
  Sentry.init({
    dsn: config.SENTRY_DSN,
    environment: config.NODE_ENV,
    tracesSampleRate: 0,
  });
  enabled = true;
  logger.info('Sentry error monitoring enabled');
}

/** No-op unless `initSentry` enabled. Pass `requestId` (and similar) via `context`. */
export function captureException(err: unknown, context?: Record<string, unknown>): void {
  if (!enabled) return;
  Sentry.captureException(err, { extra: context });
}
