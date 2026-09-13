# Gravity backend

Sync and API server for Gravity: Yjs rooms over WebSocket, replay log, Orbit LLM proxy, and invite email.

For the full product overview and Docker stack, see the [root README](../README.md). Engineering invariants live in [AGENTS.md](../AGENTS.md).

## Stack

| Piece | Choice |
| --- | --- |
| Runtime | Node 22 + Express + TypeScript |
| Sync | y-websocket (one `Y.Doc` per room) |
| Validation | zod (env, route params, DTOs) |
| Logging | pino (+ pino-http) |
| Docs | Swagger UI at `/api/docs` (OpenAPI JSON at `/api/docs.json`) |
| Monitoring | Sentry (optional; enabled when `SENTRY_DSN` is set) |

## Prerequisites

- Node.js 20+ (22 recommended)

## Setup

```bash
cp .env.example .env   # PowerShell: Copy-Item .env.example .env
npm install
npm run dev
```

| URL | What it is |
| --- | --- |
| http://localhost:4000 | API + WebSocket upgrade |
| http://localhost:4000/api/docs | OpenAPI / Swagger UI |
| http://localhost:4000/api/docs.json | OpenAPI JSON |
| http://localhost:4000/api/v1/health | Health check |

Defaults are enough to sync rooms. Optional:

| Want | Set in `.env` |
| --- | --- |
| Orbit | `LLM_API_KEY` (+ other `LLM_*`) |
| Durable invites | `REDIS_URL=redis://127.0.0.1:6379` (Redis must be running) |
| Real email | `SMTP_*` + `INVITE_FROM_EMAIL` (see `.env.example`) |

Full step-by-step (Docker Redis, local Redis helper, Share flow): [root README](../README.md).

### Invite email queue (BullMQ)

`POST /api/v1/invite` enqueues each recipient and returns immediately.

| `data.mode` | Meaning |
| --- | --- |
| `queued` | SMTP configured; BullMQ/memory worker sends in the background |
| `deferred` | SMTP unset; job completes as a log only |

| Setup | Queue driver |
| --- | --- |
| `REDIS_URL` set | BullMQ + Redis (jobs survive backend restart) |
| `REDIS_URL` unset, or `NODE_ENV=test` | In-memory fallback |

Docker Compose starts Redis and sets `REDIS_URL=redis://redis:6379`. Local Redis example:

```bash
docker run --rm -d --name gravity-redis -p 6379:6379 redis:7-alpine
```

Then set `REDIS_URL=redis://127.0.0.1:6379` and `npm run dev`.

## Environment

| Variable | Role |
| --- | --- |
| `PORT` | HTTP listen port (default `4000`) |
| `CORS_ORIGIN` | CORS allowlist (`*` in local dev) |
| `LOG_LEVEL` | pino level |
| `AUTH_MODE` | Guest seam today (`guest`) |
| `SENTRY_DSN` | Optional error reporting |
| `APP_NAME` | Backend product name (Swagger, logs, invite copy; default `Gravity`) |
| `API_PREFIX` | REST mount (default `/api/v1`; keep Nginx `/api/` in sync) |
| `API_DOCS_PATH` | Swagger UI path (default `/api/docs`) |
| `WS_PATH_PREFIX` | WebSocket prefix (default `/ws`; keep Nginx `/ws/` in sync) |
| `ROOM_NAME_REGEX` | Optional override (not in `.env.example`). RegExp source without `/` delimiters; default `^[A-Za-z0-9_-]{4,64}$` in `app.defaults.ts`. Docker: set in root `.env` (loaded via Compose `env_file`) |
| `REPLAY_LOG_MAX_ENTRIES` | Replay log cap per room (default `100000`) |
| `ROOM_PERSIST_DEBOUNCE_MS` | Room snapshot debounce (default `1000`) |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | REST rate limit per IP (default `60000` / `300`) |
| `LLM_*` | Orbit provider, model, timeout |
| `REDIS_URL` | BullMQ Redis URL (unset → in-memory invite queue) |
| `SMTP_*` / `INVITE_*` | Invite mail SMTP transport (Docker: set in root `.env`) |
| `EMAIL_QUEUE_CONCURRENCY` | Max concurrent SMTP sends (default `2`) |
| `EMAIL_QUEUE_MAX_ATTEMPTS` | Retries before permanent failure (default `3`) |
| `EMAIL_QUEUE_RETRY_BASE_MS` | Base retry delay ms (default `1000`) |
| `EMAIL_QUEUE_MAX_PENDING` | Soft pending-job cap (default `500`) |
| `EMAIL_QUEUE_FLUSH_TIMEOUT_MS` | Shutdown flush wait ms (default `8000`) |
| `EMAIL_QUEUE_NAME` | BullMQ queue / Redis key prefix (default `gravity-invite-email`) |
| `FRONTEND_PORT` | Local frontend port for invite links (e.g. `5173`) |
| `APP_PUBLIC_URL` | Base URL for invite links (e.g. `http://localhost:${FRONTEND_PORT}`) |

Parsed fail-fast in `src/config/config.ts`. Defaults live in `src/constants/app.defaults.ts` and `src/constants/email-queue.constants.ts`. See `.env.example`.

Request bodies use **Zod** at the HTTP boundary (`validators/` + `validateBody` / `validateParams`). Invite `callUrl` keeps a small custom host allowlist on top of URL parsing. Media uploads use **`file-type`** magic-byte sniffing plus the MIME allowlist in `media.constants.ts` (text/some audio fall back to the declared type when there is no signature).

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | `tsx watch` on `src/index.ts` |
| `npm run build` | Compile to `dist/` |
| `npm start` | Run compiled server |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit + Supertest integration (in-process; no listen) |
| `npm run test:e2e` | Black-box HTTP + WebSocket e2e (`e2e/`; spawns a real server) |

```bash
npm install
npm test                 # unit + integration
cd e2e && npm install && npm test   # or: npm run test:e2e
```

```powershell
npm install
npm test
cd e2e; npm install; npm test   # or: npm run test:e2e
```

Black-box details: [e2e/README.md](./e2e/README.md).

## Layout

```
src/
  index.ts           # Listen, WS upgrade, graceful shutdown
  app.ts             # Middleware pipeline (testable, no .listen)
  config/            # Env (zod)
  constants/
  types/             # Identity, ApiError, y-websocket .d.ts
  dto/               # Zod schemas + inferred types
  validators/
  middleware/        # request-id, validate, auth, errors
  controllers/       # Thin: shape service results into DTOs
  services/          # Business logic (no Express imports)
  sockets/           # yjs-sync.ts
  routes/            # health, replay, orbit, invite
  llm/               # Providers, prompts, op validation
  observability/     # logger, sentry
  docs/              # swagger.ts
```

Product name: backend `APP_NAME` env (default in `constants/app.defaults.ts`) plus the frontend `APP_NAME` constant. Path prefixes are env-overridable but must match the Vite proxy / Docker Nginx.

## API surface (high level)

- `GET /api/v1/health`: liveness
- `GET /api/v1/replay/:room`: time-travel update log
- `POST /api/v1/orbit/chat`: Orbit assistant (needs LLM env)
- `POST /api/v1/invite`: enqueue room invite emails (BullMQ/Redis or memory; SMTP; deferred log when unset)
- WebSocket `/ws/<roomId>`: Yjs sync + awareness

Room documents persist as `{DATA_DIR}/rooms/<room>.yjs` snapshots. Replay logs append to `{DATA_DIR}/replay/<room>.ndjson`. Media uploads live under `{DATA_DIR}/media/`. Clients also keep an IndexedDB cache for offline editing.

## Conventions

- Services never import Express; controllers stay thin.
- Errors go through the central error middleware: `{ error: { code, message, requestId } }`.
- Validate at system boundaries only (env, HTTP params/body).
- Auth seam: `Identity` + `auth.middleware.ts` (HTTP) and `?token` on the WS URL. JWT later should touch those slots only.
- Logging via `observability/logger`; no bare `console.*`.

## Working with the frontend

Local SPA expects this server on `:4000`. Full-stack Docker proxies `/api/*` and `/ws/*` through Nginx on `:8080`; see root README.
