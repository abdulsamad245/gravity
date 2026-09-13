# Backend e2e

Black-box tests against a **listening** Gravity server (real HTTP + y-websocket).

The suite spawns `backend/src/index.ts` on an ephemeral port with an isolated
`DATA_DIR`, so it does not need Docker or a manually started `:4000` process.

## Prerequisites

Install backend deps (for `tsx` + server code), then e2e deps:

```bash
# macOS / Linux / Git Bash
cd backend && npm install
cd e2e && npm install
```

```powershell
# Windows PowerShell
cd backend; npm install
cd e2e; npm install
```

## Run

```bash
cd backend/e2e && npm test
# or: cd backend && npm run test:e2e
```

```powershell
cd backend\e2e; npm test
# or: cd backend; npm run test:e2e
```

## What it covers

- Success / error API envelopes over the wire (`/health`, `/rooms/.../exists`, `/replay`, `/media`, `/invite`, `/orbit/chat`)
- Media upload + raw byte download
- Invite queue accepts without SMTP (`mode=deferred`) and with optional `callUrl`
- OpenAPI JSON at `/api/docs.json` lists every REST path
- Orbit local/unavailable reply without an LLM key
- Invalid WebSocket room → close `4400`
- Two-client Yjs sync and replay log growth
- Guest `?token=` query seam still connects

In-process Supertest coverage stays in `backend/tests` (`npm test` from `backend/`).
Browser e2e: `frontend/e2e` (local `:5173`, or `BASE_URL=http://localhost:8080` against Docker).

Full beginner path: root [README.md](../../README.md) § Tests (local).
