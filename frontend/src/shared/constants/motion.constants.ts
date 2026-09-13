/**
 * Shared motion timings. Keep short enough that UI feels snappy, long enough
 * that first-run overlays do not pop in.
 */
export const MOTION_MS = 320;

/** Board-start + Orbit dock: slightly softer than generic dialogs. */
export const SURFACE_MOTION_MS = 380;

/** Compact chrome menus (More). Snappier than full surfaces. */
export const MENU_MOTION_MS = 200;

/** Mobile hamburger menu panel + scrim. */
export const MOBILE_MENU_MOTION_MS = 280;

/**
 * Room open allowance before first-run overlays (AI start chat, product tour).
 * Wait for IndexedDB sync (capped), then a short settle for chrome/layout.
 */
export const ROOM_SYNC_WAIT_MAX_MS = 900;
export const ROOM_CHROME_SETTLE_MS = 420;

/**
 * Beat after chrome is ready before the empty-board AI start chat mounts.
 * Lets the toolbar/presence ease in first, then the chat follows.
 */
export const BOARD_START_REVEAL_DELAY_MS = 320;
