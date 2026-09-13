export const ZOOM_MIN = 0.05;
export const ZOOM_MAX = 8;
export const ZOOM_STEP = 1.06;

export const GRID_BASE_SPACING = 64;

/** How often local cursor/viewport presence is broadcast (ms). */
export const AWARENESS_THROTTLE_MS = 33;

/** How often object drags commit intermediate positions to Yjs (ms). */
export const DRAG_COMMIT_THROTTLE_MS = 50;

/** How often an in-progress pen stroke commits points to Yjs (ms). */
export const PEN_COMMIT_THROTTLE_MS = 80;

export const DEFAULTS = {
  rect: { width: 160, height: 110 },
  ellipse: { width: 140, height: 140 },
  triangle: { width: 140, height: 120 },
  diamond: { width: 140, height: 140 },
  star: { width: 140, height: 140 },
  hexagon: { width: 140, height: 140 },
  line: { width: 200, height: 24 },
  arrow: { width: 200, height: 24 },
  elbowArrow: { width: 180, height: 120 },
  blockArrow: { width: 200, height: 100 },
  divider: { width: 280, height: 16 },
  sticky: { width: 180, height: 180 },
  text: { width: 240, height: 40 },
  code: { width: 440, height: 260 },
  audio: { width: 148, height: 40 },
  frame: { width: 480, height: 320 },
  /** Compact diagram container (boundary + quick-start; shorter than a full board). */
  diagram: { width: 560, height: 280 },
  table: { width: 360, height: 200 },
  chart: { width: 360, height: 240 },
  mindmap: { width: 190, height: 72 },
  stamp: { width: 56, height: 56 },
  embed: { width: 480, height: 320 },
  video: { width: 360, height: 220 },
  file: { width: 220, height: 72 },
} as const;

export const HIGHLIGHTER_STROKE = 18;
export const HIGHLIGHTER_OPACITY = 0.4;
/** Default freehand pen width (highlighter uses HIGHLIGHTER_STROKE). */
export const PEN_STROKE_WIDTH = 4;

/** Arrow-key nudge distance; Shift uses the larger step. */
export const NUDGE_STEP = 1;
export const NUDGE_STEP_SHIFT = 10;

/** nanoid length for canvas object ids. */
export const OBJECT_ID_LENGTH = 10;

export const DEFAULT_TABLE_CELLS = ',,\n,,\n,,';

export const DEFAULT_FONT_SIZE = 24;
export const STICKY_FONT_SIZE = 18;
