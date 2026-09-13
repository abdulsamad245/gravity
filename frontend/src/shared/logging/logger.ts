/**
 * Leveled frontend logger — the single owner of console output.
 * Debug/info are silenced in production builds; warnings and errors
 * always surface (and errors flow to Sentry via the ErrorBoundary).
 */
const isDev = import.meta.env.DEV;

export const logger = {
  debug: (...args: unknown[]) => {
    if (isDev) console.debug('[gravity]', ...args);
  },
  info: (...args: unknown[]) => {
    if (isDev) console.info('[gravity]', ...args);
  },
  warn: (...args: unknown[]) => console.warn('[gravity]', ...args),
  error: (...args: unknown[]) => console.error('[gravity]', ...args),
};
