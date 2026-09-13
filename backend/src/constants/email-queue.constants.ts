/**
 * Compile-time defaults for the invite email queue. Overridable via env
 * (see config.ts). Keep aligned with root/backend `.env.example`.
 */
export const EMAIL_QUEUE_DEFAULTS = {
  /** Max concurrent SMTP deliveries (keep low; providers rate-limit). */
  CONCURRENCY: 2,
  /** Attempts per message before permanent failure. */
  MAX_ATTEMPTS: 3,
  /** Base delay before retry (BullMQ fixed backoff; memory queue multiplies by attempt). */
  RETRY_BASE_MS: 1_000,
  /** Soft cap so a stuck queue cannot grow without bound. */
  MAX_PENDING: 500,
  /** Graceful shutdown: wait this long for in-flight + pending sends. */
  FLUSH_TIMEOUT_MS: 8_000,
  /** BullMQ queue name (Redis key prefix). */
  NAME: 'gravity-invite-email',
} as const;
