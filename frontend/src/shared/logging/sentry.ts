import * as Sentry from '@sentry/react';
import { logger } from './logger';

let enabled = false;

/**
 * Initializes Sentry error monitoring — only when VITE_SENTRY_DSN is set
 * at build time. The app runs identically without it.
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) {
    logger.debug('Sentry disabled (no VITE_SENTRY_DSN)');
    return;
  }
  Sentry.init({ dsn, environment: import.meta.env.MODE });
  enabled = true;
  logger.info('Sentry error monitoring enabled');
}

/** No-op unless `VITE_SENTRY_DSN` was configured at build time. */
export function captureException(err: unknown): void {
  if (enabled) Sentry.captureException(err);
}

/** Attaches room/user context to future error reports. */
export function setSentryContext(roomId: string, username: string): void {
  if (!enabled) return;
  Sentry.setTag('room', roomId);
  Sentry.setUser({ username });
}
