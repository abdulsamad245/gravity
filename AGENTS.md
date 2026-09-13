# AGENTS.md: Gravity engineering guide

Everything an agent (or engineer) needs to work on this codebase without re-deriving decisions.

## What this is

**Gravity**: a real-time collaborative infinite canvas (whiteboard category) with physics, offline
sync, minimap radar, export (PNG/SVG/JSON), and full-session time-travel replay.

**Product category:** collaborative infinite whiteboard + physics. Fair competitors are FigJam,
Miro whiteboard, Mural, Lucidspark, Whimsical, Excalidraw. We are **not** cloning Figma Design
(components, Auto Layout, Dev Mode) or Miro's entire enterprise platform (250 integrations,
Miroverse marketplace, SSO).

**Differentiators:** physics (throw, collide, attract/repel, wind, topic magnets, archive wells,
board gravity, ropes, shake/settle, vote mass), offline CRDT sync, full session replay.

Monorepo with independently deployable `backend/` and `frontend/`. Root `README.md` is the
beginner-facing setup guide: get the code, install Docker or Node, start, verify, use the
app, run tests, and basic troubleshooting. Keep that path complete when you change run
commands. Short version: `docker compose up --build` (:8080); local `npm run dev` in
`backend/` (:4000) and `frontend/` (:5173); e2e accepts `BASE_URL` (Docker:
`http://localhost:8080`).

The product name: backend `APP_NAME` env (default in `backend/src/constants/app.defaults.ts`,
resolved via `app.constants.ts`) and `frontend/src/shared/constants/app.constants.ts`. Rename
both (or override backend via env). Other former hardcodes (`API_PREFIX`, rate limits, etc.)
are env-driven with the same defaults; path prefixes must stay aligned with Nginx / Vite proxy.

Visual identity: root `DESIGN.md` (tokens + rationale). Changelog: root `CHANGELOG.md`.

**Changelog rules:** `CHANGELOG.md` records product and user-visible app changes (features,
behavior, APIs, UX, security). Prefer a clean **Added** / **Changed** list of capabilities.
Do **not** log iterative bug-fix churn, env boot mishaps, layout debugging, duplicate fix
entries, doc rewrites, README tidy-ups, demo-script edits, agent-guide updates, screenshot
moves, dead-file deletion, or test-helper churn. Fold polish into the feature note once;
never narrate the development procedure.

## Language and standards

- **TypeScript strict** on both frontend and backend. No new application `.js` / `.jsx` sources.
- Prefer industry standards and established libraries (Yjs, Matter.js, Konva, Zod, Playwright,
  axe-core, OpenAPI, WCAG 2.2). Invent only when no standard exists; document why in code comments.
- User-facing copy: short, concrete, human. **No em dashes** anywhere in UI or docs we ship.
- Env-driven config: `backend/.env.example`, `frontend/.env.example`, root `.env.example`. Never
  hardcode secrets or deploy-specific URLs when an env var belongs there.

## Stack and why

| Piece | Choice | Why |
| --- | --- | --- |
| Sync | Yjs + y-websocket | CRDT: merge, awareness, offline, replay from one model |
| Canvas | Konva / react-konva | Scene graph, hit-testing, React bindings |
| Physics | Matter.js | Client-side rigid bodies + host election |
| Frontend | React 19 + Vite + TS + PWA | Client-heavy SPA; installable offline shell; no SSR |
| Backend | Node 22 + Express + TS | Native y-websocket utilities |
| State | zustand | UI/camera/theme that must not enter the shared doc |
| Validation | zod | DTO schemas + inferred types |
| Logging | pino (+ pino-http) | Structured JSON, request-id |
| Monitoring | Sentry (optional) | When DSN env vars are set |
| A11y audits | @axe-core/playwright + jsx-a11y | WCAG automation in CI |

## API response envelope

All JSON REST responses use:

```json
{ "data": {}, "meta": { "requestId": "...", "timestamp": "..." } }
```

or

```json
{ "error": { "code": "...", "message": "...", "requestId": "...", "details?": {} }, "meta": { ... } }
```

Controllers respond only through `ApiResponse` (`backend/src/shared/http/api-response.ts`).
Error middleware uses the same helper. OpenAPI must document this shape. Frontend clients unwrap
`body.data`.

## Architecture

```
Browser ── WebSocket /ws/<roomId> ──► backend y-websocket relay + durable RoomPersistenceService
 └── HTTP /api/v1/* ──────────► health, replay, media, orbit, invite (envelope)
Docker: Nginx serves SPA and proxies /api + /ws. DATA_DIR holds rooms, replay, and media.
```

### Data model

`CanvasObject` in `frontend/src/shared/types/index.ts`. Stored as nested `Y.Map`s.
Origins: `TX_ORIGIN_LOCAL` (undoable), `TX_ORIGIN_PHYSICS` (echo-loop prevention). Never write
without an origin.

### Physics

`PhysicsController`: host = lowest awareness clientID. Throws via `impulse`. Attract/repel/wind
and shake via awareness. Object roles `magnet` / `archiveWell`; settle and place helpers in
`physics-actions.ts`. Tunables in `physics.constants.ts`.

### Guest identity

Per-tab identity in `sessionStorage` only (id, color, optional avatar). Last-used **username** prefill
in `localStorage`; never mirror the full identity there (XSS / shared-machine durable leak).
Device username registry (`gravity.usernames`) powers auto-generate without clashes across tabs.
Click own avatar to edit username and avatar color. Two people on one device = two tabs = two identities.
Client storage is plaintext by design; do not add FE-only “encryption” with a bundled key. Real board
privacy needs auth and/or user-held E2EE, not obfuscated Web Storage.

### Theme

`theme.store`: preference `light | dark | system`, resolved theme on `<html data-theme>`,
persisted. Canvas bg/grid from `canvasThemeColors(resolved)`. UI chrome uses Lucide icons
and custom dialogs (`DialogHost`), not unicode tool glyphs or `window.alert`.

## Accessibility (WCAG 2.2 AA target)

- Semantic landmarks; accessible names on controls; `:focus-visible`; min target ~36px (44px touch).
- Keyboard path for tools, nudge, menus (`Shift+F10` / context menu), dialogs with focus trap.
- Non-drag alternatives for move/resize (SC 2.5.7): arrows + context actions.
- `aria-live="polite"` for offline/online and major status.
- `prefers-reduced-motion` respected.
- Canvas bitmap is limited for screen readers; provide object outline / announcements for selection
  when adding features. Images should support alt text.
- Automate with axe on chrome pages; never claim full compliance from automation alone.

## Testing pyramid

```
        E2E per app
       /            \
 frontend/e2e     backend/e2e
 (Playwright+axe) (HTTP+WS black-box)
       |                |
 FE unit (Vitest)   BE unit + integration (Vitest+Supertest)
```

- Browser Playwright: `frontend/e2e` (Chromium, Firefox, WebKit). Backend unit + in-process
  Supertest: `backend` (`npm test`). Backend HTTP+WS black-box: `backend/e2e` (spawns a
  listening server; `npm run test:e2e` from `backend/`). Commands are listed in `README.md`.
- **Write tests last** after features stabilize.
- Dev seam: `window.__gravityProvider` for offline socket tests (stripped conceptually for prod
  via `import.meta.env.DEV`).

## Layout

```
backend/src/   config, constants, dto, validators, middleware, controllers, services,
               sockets, observability, docs, shared/http (ApiResponse), app.ts, index.ts
frontend/src/  app/, shared/, stores/, features/{collaboration,canvas,physics,minimap,
               replay,export,media,landing}
DESIGN.md      design tokens + rationale
CHANGELOG.md   Keep a Changelog
```

## Conventions

- No TypeScript `enum` (const unions). No magic numbers (constants files).
- Validate at boundaries only (HTTP, import JSON, env).
- Backend: services never import Express; controllers never hold business logic.
- Frontend: shared doc via RoomConnection only; ephemeral UI in zustand.
- Auth seam: Identity + auth middleware + WS `?token` slot.
- Logging: observability/logger (BE), shared/logging/logger (FE). No bare `console.*` elsewhere
  except logger implementations.
- **Orbit product knowledge:** when you add or move user-facing UI, update
  `backend/src/llm/orbit-product-help.ts` (system prompt capabilities + UI map) and the matching
  how-tos in `frontend/src/features/sidekick/orbit-intent.ts` so Orbit answers stay accurate.
- **Product tour:** board chrome walkthrough lives in `frontend/src/features/tour/product-tour.ts`
  with `data-tour` targets on chrome. Bump `PRODUCT_TOUR_VERSION` in `tour.constants.ts` when
  steps change so returning users see the new walkthrough once.

## Feature backlog pointer

Context menus polish, multi-select refinements, connectors/frames depth, templates, Sidekick,
facilitation depth, physics beyond (ropes/constraints polish), a11y outline panel.
See conversation plan Waves 1 to 10. Prefer matching whiteboard leaders, then Gravity-only physics.

## Gotchas

1. Yjs `event.changes` must be read synchronously inside the observer (not inside React updaters).
2. Focus from mousedown: defer with `requestAnimationFrame` (TextEditOverlay).
3. Playwright `setOffline` does not sever live WebSockets; close `provider.ws` too.
4. Konva Stage drag: check `e.target === stage` or object drags also pan.
5. Context menu: `preventDefault` on stage `contextmenu`; menus are HTML overlays, not Konva.
6. API clients must read `response.data` after the envelope migration.
