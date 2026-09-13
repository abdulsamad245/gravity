# Changelog

All notable changes to Gravity are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Orbit transcribes voice notes (Whisper) and answers the spoken request instead of asking how to place the audio
- Orbit describes attached images (vision) and responds from that understanding instead of filename-only
- Voting sessions: optional time limit (auto-reveal), anonymous results (default), I'm done progress for the host, and tallies that stay on objects after Clear (with physics mass)

### Changed
- Orbit no longer dims the whole board when answering; Show me uses a ring and label only, and create/build prompts are not treated as how-tos
- Product tour (v11) and Orbit how-tos cover improved Facilitate voting (timer, anonymous, I'm done, persistent results)

### Changed
- Soft Install app card no longer snoozes when you close Orbit, use the product tour, or click other chrome; only X, Not now, Escape (when free), or a board-canvas click dismisses it
- Session replay WebM export runs on an offscreen stage so you can Exit replay and keep editing while the clip encodes; progress card or chip stays available, and a toast (plus desktop notification if the tab is hidden) fires when the WebM downloads
- Room open eases in after a short ready settle; product tour welcome and AI start chat / Orbit dock use softer entrance motion
- Empty-board AI start chat waits a short beat after chrome is ready before easing in
- Live call accepts Meet, Zoom, Discord, Teams, Whereby, Webex, Jitsi, and Skype links; only the room creator can set or clear the link (others use Join call)
- Product tour (v10) and Orbit how-tos cover Live call providers, owner-only manage, background WebM export, and clearer More → Board actions (Import board, Open session history) vs Replay → Save session history

## [1.0.0] - 2026-07-25

### Added
- Real-time collaborative infinite canvas (Yjs + y-websocket) with offline CRDT sync
- Drawing and board tools: pen, rect, ellipse, sticky, text, eraser, multi-select marquee (Space pans)
- Frames, tables, connectors, object lock, copy/cut/paste, and copy link to object (`?focus=`)
- Object-linked connectors with straight, right-angle, curved, and polyline routing
- Image, audio, and voice note (mic on the primary toolbar next to Image); board videos capped at 1.5 MB by file size
- Other resources under ··· More tools: image, video, audio, document, table, slide, PDF, and file cards; offline data URLs promote to durable media when the room is back online
- Web embed tool: validated public URL on the board with live preview when possible (YouTube / Vimeo and iframe-friendly sites), Visit link on hover, and a clickable link card fallback; shared http(s) checker with inline errors for mangled URLs
- Charts library under ··· More tools (clustered/stacked/100% bars and columns, combination, line, area, pie, donut, rose, scatter, radar)
- Stickers panel (Stickers, Emoji, GIFs); More shapes (Building tools plus diagramming, UML, ERD, cloud, and network packs)
- Collaborative code blocks (CodeMirror, syntax highlighting, line numbers, language, font size)
- Selection toolbar text tools: A + color stroke picker, B/I/U/S, lists with indent, insert link, highlight colors, and a More (⋮) overflow menu
- Physics: throw, collide, attract/repel, ropes, wind, topic magnets, archive wells, board shake, settle/align, vote-based mass, locked objects stay pinned, host election, and board gravity toggle
- Left toolbar primary rail: everyday tools plus Physics, Connect, Image, and Voice note; embeds, charts, and resources under ··· More tools (compact color picker, scrollable menus)
- Facilitation: timer (Time up until explicit reset), stamps, laser, ropes; private brainstorming rounds and hidden-ballot voting with reveal; Voting chip and vote progress while ballots are open
- Workshop tools from the clock control (closed by default); scrollable bottom sheet on phones; sticker/GIF previews with More opening the full picker
- Mind maps with child ideas, auto-layout, and branch collapse
- Record-backed tables with table, kanban, and timeline views
- Templates modal with workshop layouts (brainstorm, affinity, SWOT, journey, kanban, sprint, and more)
- Presentation mode: frames as slides (fullscreen, lightbox, keyboard nav, slide overview) plus talktrack recording with optional microphone and WebM download
- Orbit board agent: create and edit stickies, shapes, frames, connectors, and templates from chat; streaming replies with Thinking / Stop; Quick starts and Send as board commands
- Orbit clustering and summarization from whole-board sticky context; short confirmation follow-ups (“yes”, “ok”); rotating example asks; text excerpts from attached documents
- Orbit product how-tos with soft UI spotlight, compact tour-style label, and Show me; answers toolbar paths (table, kanban, mind map, and related); refuses secrets and scrubs accidental leaks
- Orbit chat history per room and guest identity (New chat / History); LLM-safe prompt and upload limits on client and API
- Share: room link, email invites (BullMQ + Redis when `REDIS_URL` is set, in-memory fallback otherwise; API returns `queued` / `deferred`), iframe embed snippet (`?embed=1`), and Live call (Meet / Zoom / Discord link; Join call opens a new tab; invites include the call link when set)
- Session replay with time-travel, rewind / fast-forward (5s, arrow / J / L), playback speeds that follow recorded timing, downloadable session history, and WebM video export
- Minimap radar and follow user; minimap eases aside when Orbit is open
- Export PNG / SVG / JSON
- Installable PWA: home-screen / desktop install, offline app shell, and soft in-app Install Gravity prompt
- First-run product tour of board chrome (Skip / Take a tour in More), with light scrim and spotlight on the real toolbar panel
- Per-tab guest identity with Username profile editor (name, avatar color or photo, mutually exclusive); username auto-generate that skips names already used on this device; username prefill in localStorage only
- Unique room ids; live board URLs at `/rooms/:roomId` (legacy `/room/:id` redirects); same-tab refresh restores camera, selection, tool, and Orbit open state
- Durable room snapshots, replay logs, and media under `DATA_DIR`; Docker Compose mounts `backend/data`
- Compact floating board chrome, Quick start chips, participant avatars with `+N` popover, connection status next to presence, theme Light / Dark / System, and accessible custom dropdowns
- Mobile: More menu under the button with grouped sections (Room, Tools, Board, Export); Gravity toggle pinned bottom-right with compact minimap above it; viewport-level overflow so menus are not clipped
- Right-click context menus (empty board and object); Lucide toolbar icons; custom dialog host; error dialogs with plain language plus Technical details
- Standard REST response envelope (`data` / `error` + `meta`); frontend client unwraps `data`
- Accessibility basics: skip link, focus-visible, live region, reduced motion, selection outline; user-facing copy without em dashes
- Guest auth seam, Docker Compose, Swagger docs, env examples, and DESIGN.md visual tokens
- Backend and frontend unit tests; Playwright suite under `frontend/e2e` (Chromium / Firefox / WebKit), including multi-user flows
