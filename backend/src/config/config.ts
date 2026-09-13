import dotenv from 'dotenv';
import { z } from 'zod';
import { APP_DEFAULTS } from '../constants/app.defaults';
import { EMAIL_QUEUE_DEFAULTS } from '../constants/email-queue.constants';
import {
  LLM_DEFAULT_BASE_URL,
  LLM_DEFAULT_MODEL,
  LLM_DEFAULT_TIMEOUT_MS,
  LLM_DEFAULT_TRANSCRIBE_MODEL,
} from '../constants/llm.constants';

dotenv.config();

/** Expand `${VAR}` refs in process.env (Compose-style). dotenv does not do this itself. */
function expandEnvRefs(env: NodeJS.ProcessEnv = process.env): void {
  for (const [key, value] of Object.entries(env)) {
    if (!value?.includes('${')) continue;
    env[key] = value.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name: string) => env[name] ?? '');
  }
}

expandEnvRefs();

function emptyToUndef<T extends z.ZodType>(schema: T) {
  return z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), schema);
}

function pathPrefix(defaultValue: string) {
  return z
    .string()
    .min(1)
    .regex(/^\/[A-Za-z0-9/_-]*$/, 'Must be a URL path starting with /')
    .default(defaultValue);
}

/**
 * Env config validated at boot (Zod). Missing optional secrets
 * (LLM_API_KEY, SMTP_PASS, …) still allow boot; those features stay off until set.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  /** Comma-separated allowed origins, or '*' (default). */
  CORS_ORIGIN: z.string().default('*'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  /** Durable Yjs snapshots and replay events. Relative paths resolve from backend cwd. */
  DATA_DIR: z.string().min(1).default('./data'),
  /** Empty string in .env must not fail boot (common when the key is left blank). */
  SENTRY_DSN: emptyToUndef(z.string().url().optional()),
  /** Auth seam: 'guest' today; a future 'jwt' mode changes only auth middleware. */
  AUTH_MODE: z.enum(['guest']).default('guest'),

  /** Backend product name (Swagger title, logs, invite copy). */
  APP_NAME: z.string().min(1).default(APP_DEFAULTS.APP_NAME),
  /** REST mount path. Docker Nginx proxies `/api/` — keep in sync if changed. */
  API_PREFIX: pathPrefix(APP_DEFAULTS.API_PREFIX),
  /** Swagger UI path. Served by Express; Nginx proxies `/api/`. */
  API_DOCS_PATH: pathPrefix(APP_DEFAULTS.API_DOCS_PATH),
  /** WebSocket path prefix. Docker Nginx proxies `/ws/` — keep in sync if changed. */
  WS_PATH_PREFIX: pathPrefix(APP_DEFAULTS.WS_PATH_PREFIX),
  /** Room id pattern (RegExp source). Default: URL-safe nanoid alphabet, 4-64 chars. */
  ROOM_NAME_REGEX: z
    .string()
    .min(1)
    .default(APP_DEFAULTS.ROOM_NAME_REGEX)
    .transform((source, ctx) => {
      try {
        return new RegExp(source);
      } catch {
        ctx.addIssue({ code: 'custom', message: 'Invalid regular expression' });
        return z.NEVER;
      }
    }),
  REPLAY_LOG_MAX_ENTRIES: z.coerce
    .number()
    .int()
    .positive()
    .default(APP_DEFAULTS.REPLAY_LOG_MAX_ENTRIES),
  ROOM_PERSIST_DEBOUNCE_MS: z.coerce
    .number()
    .int()
    .nonnegative()
    .default(APP_DEFAULTS.ROOM_PERSIST_DEBOUNCE_MS),
  RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(APP_DEFAULTS.RATE_LIMIT_WINDOW_MS),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(APP_DEFAULTS.RATE_LIMIT_MAX),

  /** LLM: openai | openai_compatible (Groq, Ollama, Azure compat, etc.). */
  LLM_PROVIDER: z.enum(['openai', 'openai_compatible']).default('openai'),
  LLM_API_KEY: emptyToUndef(z.string().min(1).optional()),
  LLM_BASE_URL: z.string().url().default(LLM_DEFAULT_BASE_URL),
  LLM_MODEL: z.string().min(1).default(LLM_DEFAULT_MODEL),
  LLM_TRANSCRIBE_MODEL: z.string().min(1).default(LLM_DEFAULT_TRANSCRIBE_MODEL),
  LLM_TIMEOUT_MS: z.coerce.number().int().positive().default(LLM_DEFAULT_TIMEOUT_MS),

  /** SMTP invite transport (optional — invites succeed + log when unset). */
  SMTP_HOST: emptyToUndef(z.string().min(1).optional()),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  SMTP_USER: emptyToUndef(z.string().optional()),
  SMTP_PASS: emptyToUndef(z.string().optional()),
  INVITE_FROM_EMAIL: emptyToUndef(z.string().email().optional()),
  INVITE_FROM_NAME: z.string().min(1).default(APP_DEFAULTS.APP_NAME),
  /**
   * Frontend host port for local invite links. Used when APP_PUBLIC_URL contains
   * `${FRONTEND_PORT}` (e.g. http://localhost:${FRONTEND_PORT}).
   */
  FRONTEND_PORT: emptyToUndef(z.coerce.number().int().positive().optional()),
  /** Public app base URL for invite links (supports `${FRONTEND_PORT}`). */
  APP_PUBLIC_URL: emptyToUndef(z.string().url().optional()),

  /**
   * Redis for BullMQ invite email. When unset, invites use the in-memory queue
   * (fine for unit tests / offline local). Docker sets redis://redis:6379.
   */
  REDIS_URL: emptyToUndef(z.string().min(1).optional()),

  /** Invite email queue tunables (BullMQ worker + in-memory fallback). */
  EMAIL_QUEUE_CONCURRENCY: z.coerce
    .number()
    .int()
    .positive()
    .default(EMAIL_QUEUE_DEFAULTS.CONCURRENCY),
  EMAIL_QUEUE_MAX_ATTEMPTS: z.coerce
    .number()
    .int()
    .positive()
    .default(EMAIL_QUEUE_DEFAULTS.MAX_ATTEMPTS),
  EMAIL_QUEUE_RETRY_BASE_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(EMAIL_QUEUE_DEFAULTS.RETRY_BASE_MS),
  EMAIL_QUEUE_MAX_PENDING: z.coerce
    .number()
    .int()
    .positive()
    .default(EMAIL_QUEUE_DEFAULTS.MAX_PENDING),
  EMAIL_QUEUE_FLUSH_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(EMAIL_QUEUE_DEFAULTS.FLUSH_TIMEOUT_MS),
  EMAIL_QUEUE_NAME: z.string().min(1).default(EMAIL_QUEUE_DEFAULTS.NAME),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // Logger is not available yet at config-parse time.
  // eslint-disable-next-line no-console
  console.error('Invalid environment configuration:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  corsOrigins:
    parsed.data.CORS_ORIGIN === '*'
      ? ('*' as const)
      : parsed.data.CORS_ORIGIN.split(',').map((o) => o.trim()),
  inviteEmailConfigured: Boolean(parsed.data.SMTP_HOST && parsed.data.INVITE_FROM_EMAIL),
  llmConfigured: Boolean(parsed.data.LLM_API_KEY),
  redisUrl: parsed.data.REDIS_URL,
};
export type AppConfig = typeof config;
