# Gravity Design Guide

Gravity is a collaborative infinite canvas for workshops, diagrams, planning, and physics-backed facilitation. The interface should feel precise, calm, and fast under repeated use.

## Principles

- The canvas is the product. Chrome should help people act without competing with board content.
- Collaboration must feel live. Presence, cursors, comments, invites, and access states need clear feedback.
- Physics should feel useful, not decorative. Motion must clarify relationships, sorting, clustering, and facilitation.
- Controls should be predictable. Use standard icons, labels, tooltips, menus, dialogs, and keyboard paths.
- Accessibility is a baseline. Meet WCAG 2.2 AA targets where possible and keep reduced-motion paths intact.

## Visual System

### Color

Gravity uses neutral UI surfaces with high-contrast text and restrained accent colors.

| Role | Token | Value | Usage |
| --- | --- | --- | --- |
| Background | `--color-bg` | `#f7f5ef` | App background and low-emphasis panels |
| Surface | `--color-surface` | `#fffaf0` | Menus, dialogs, sheets |
| Canvas | `--color-canvas` | `#fbfaf7` | Default board background |
| Text | `--color-text` | `#171717` | Primary copy and labels |
| Muted text | `--color-muted` | `#5f5f5f` | Secondary metadata |
| Border | `--color-border` | `#d8d2c3` | Hairlines and separators |
| Primary | `--color-primary` | `#111827` | Main actions and active tools |
| Accent | `--color-accent` | `#f2c94c` | Brand highlights, selected states |
| Success | `--color-success` | `#2f855a` | Completed and online states |
| Warning | `--color-warning` | `#b7791f` | Caution states |
| Danger | `--color-danger` | `#c53030` | Destructive actions |

Dark theme should preserve contrast rather than invert every hue literally. Canvas grid colors should be subtle in both themes.

### Typography

- Use the app font stack defined in `frontend/src/shared/constants/fonts.constants.ts`.
- Prefer compact, readable labels over decorative display text inside the app.
- Reserve large headings for landing, onboarding, and empty states.
- Keep letter spacing at `0` unless a small uppercase label genuinely needs tracking.

### Shape And Spacing

- Cards and panels use small radii, usually `8px` or less.
- Icon buttons use stable square dimensions so hover and active states do not shift layout.
- Floating controls should use consistent gaps, padding, and touch targets.
- Avoid nested cards. Use sections, rows, or grouped controls instead.

### Motion

Motion should communicate state changes: opening panels, settling objects, replay playback, drag feedback, and physics simulation. Respect `prefers-reduced-motion` and avoid motion that blocks core workflows.

## Product Surfaces

### Board Chrome

- Left rail: creation tools and object modes.
- Top bar: room title, navigation, presence, sharing, and major workspace controls.
- Right dock: Orbit and context-rich panels.
- Floating toolbar: selection-specific actions only.
- Minimap: orientation and navigation, not decoration.

### Canvas Objects

Canvas objects should remain legible while zooming and easy to distinguish during collaboration.

- Sticky notes prioritize short text and strong color contrast.
- Connectors must remain readable against grid and object fills.
- Media objects need clear loading, error, and missing-file states.
- Code blocks use syntax highlighting without sacrificing text contrast.
- Physics objects should expose clear on/off and role states.

### Collaboration

- Presence colors should be distinct and accessible.
- Ownership, viewer/editor state, and access requests must be visible without being loud.
- Share and invite flows must clearly distinguish local links, email delivery, and optional call links.

### Orbit

Orbit is a board assistant. Its UI belongs in the app shell, not the canvas itself except when it creates or edits board objects. It should be optional, clearly unavailable when the backend key is missing, and never expose secrets or raw provider errors to users.

## Content

- Use short, concrete product copy.
- Avoid hype and generic filler.
- Do not mention internal development history or private submission context in public docs.
- Do not include live credentials, personal keys, or provider-specific secrets in documentation.
- Use `example.com` for placeholder external URLs and empty values for secret placeholders.

## Accessibility

- Every interactive control needs an accessible name.
- Keyboard users must be able to reach tools, dialogs, menus, board actions, and escape routes.
- Dialogs must trap focus and restore focus on close.
- Use `aria-live="polite"` for connection and long-running export states.
- Provide non-drag alternatives for move and resize actions where possible.
- Automated axe checks are required for chrome pages, but manual review is still needed for canvas workflows.

## Implementation Notes

- Frontend tokens live in `frontend/src/styles.css` and shared constants.
- App naming lives in backend and frontend app constants.
- Product tour copy and targets live in `frontend/src/features/tour`.
- Orbit product help lives in `backend/src/llm/orbit-product-help.ts` and `frontend/src/features/sidekick/orbit-intent.ts`.
- Keep README setup commands aligned with `docker-compose.yml`, package scripts, and env examples.
