# Gravity frontend

React SPA for Gravity: collaborative infinite canvas, presence, physics, Orbit assistant UI, rooms library, export, and session replay.

For the full product overview and Docker stack, see the [root README](../README.md). Engineering invariants live in [AGENTS.md](../AGENTS.md).

## Stack

| Piece | Choice |
| --- | --- |
| UI | React 19 + Vite + TypeScript |
| Canvas | Konva / react-konva |
| Sync | Yjs + y-websocket + y-indexeddb |
| Physics | Matter.js (client-side; host election) |
| PWA | vite-plugin-pwa (manifest + Workbox; `/api` and `/ws` network-only) |
| Local UI state | zustand |
| Validation | zod (imports / boundaries) |

## Prerequisites

- Node.js 20+ (22 recommended)
- Backend running on `:4000` for live sync (`../backend`)

## Setup

```bash
cp .env.example .env   # PowerShell: Copy-Item .env.example .env
npm install
npm run dev
```

App: [http://localhost:5173](http://localhost:5173)

Defaults are same-origin: Vite proxies `/api` and `/ws` to `localhost:4000` in DEV. Override with `VITE_API_URL` / `VITE_WS_URL` only when the API is on another host. Never put LLM or SMTP secrets in `VITE_*`; those belong on the backend.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite dev server (`:5173`); SW / PWA install disabled |
| `npm run build` | Typecheck + production build |
| `npm run preview` | Serve the production build (`:4173`) with `/api` + `/ws` proxy to `:4000` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright suite in `e2e/` |

### PWA install (production-like)

Service worker registration is off in DEV (`vite-plugin-pwa` `devOptions.enabled: false`). To see Install:

1. Keep the backend on `:4000`.
2. `npm run build` then `npm run preview` (or use root Docker on `:8080`).
3. Open http://localhost:4173 in Chrome/Edge, enter a **room**, wait ~5s.
4. Soft prompt is room-only; **More → Install Gravity** stays available when the browser can install.
5. If snoozed: `localStorage.removeItem('gravity.pwa.installDismissedAt')` and reload.

See the root [README](../README.md#install-the-pwa-desktop--home-screen) for the full checklist.

### E2E

Needs apps already up: frontend `:5173` and backend `:4000`, or Docker with
`BASE_URL=http://localhost:8080`. Playwright does not start them for you.

```bash
cd e2e
npm install
npx playwright install
npm test
```

```powershell
cd e2e
npm install
npx playwright install
npm test
# Docker stack instead:
# $env:BASE_URL = "http://localhost:8080"; npm test
```

## Layout

```
src/
  app/           # Router, ErrorBoundary
  stores/        # UI / camera / theme (never put shared doc state here)
  shared/        # types, constants, api client, utils, validation
  features/
    landing/     # Home
    boards/      # Rooms library UI (/rooms)
    canvas/      # Room page, stage, tools, objects
    collaboration/
    physics/
    minimap/
    replay/
    export/
    media/
    templates/
    facilitation/
    presentation/
    sidekick/    # Orbit panel
    tour/        # First-run product tour (driver.js)
```

Product name: `shared/constants/app.constants.ts` (`APP_NAME`). Rename there and in the backend counterpart only.

## Conventions

- Shared document state only through `RoomConnection` (Yjs). Ephemeral UI in zustand.
- Local edits use transaction origin `'local'`; physics uses `'physics'`. Never write the doc without an origin.
- Validation: **Zod** for invite emails and import JSON (`shared/validation/`); **`file-type`** for magic-byte sniffing on board/Orbit uploads (`shared/utils/file-sniff.ts`). Call/embed links keep a custom host allowlist on top of the URL parser (`validate-call-url` / `validate-embed-url`).
- Shared board objects and comments are deletable by any editor; only unrevealed private ideas stay author-only (`shared/utils/ownership.ts`). Soft client trust; Yjs peers can still write.
- Physics helpers: `features/physics` (`PhysicsController`, `physics-actions` for magnet / archive / settle / shake).
- `useObjects` keeps per-key reference stability; `ObjectNode` is memoized; preserve both for large boards.
- Logging via `shared/logging/logger`; no bare `console.*` in feature code.

## Routes

| Path | Page |
| --- | --- |
| `/` | Landing |
| `/rooms` | Personal rooms library |
| `/rooms/:roomId` | Live canvas |
| `/room/:roomId` | Redirects to `/rooms/:roomId` (legacy) |
| `/boards` | Redirects to `/rooms` |
