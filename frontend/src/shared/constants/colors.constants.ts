/**
 * Named palette tokens (see DESIGN.md): ink canvas, flare accent, orbit link,
 * sticky pastels.
 */
export const GRAVITY = {
  ink: '#12141a',
  inkSoft: '#1c1f28',
  paper: '#f3f4f7',
  paperSoft: '#e8eaef',
  flare: '#ff5c33',
  flareDeep: '#e04824',
  orbit: '#2ee6c5',
  orbitDeep: '#1bb89c',
  link: '#3d8bfd',
  danger: '#ff5c6a',
} as const;

/** Palette for user identity colors (cursors, avatars, radar). */
export const USER_COLORS = [
  '#ff5c33',
  '#2ee6c5',
  '#3d8bfd',
  '#ffb020',
  '#ff7eb6',
  '#7c6cff',
  '#69db7c',
  '#ffa94d',
  '#74c0fc',
  '#f783ac',
] as const;

/** Toolbar / shape default: no fill (outline only). */
export const NO_FILL = 'transparent';

/** Outline used when fill is transparent so shapes stay visible. */
export const DEFAULT_OUTLINE = '#9aa1b2';

/** Thin border for new outlined shapes. Users can thicken it via selection toolbar. */
export const DEFAULT_SHAPE_STROKE_WIDTH = 1;

export function isNoFill(c: string): boolean {
  return c === 'transparent' || c === 'none' || c === '';
}

/** Paint for new closed shapes from the toolbar fill color. */
export function shapePaintFromFill(fillColor: string): {
  fill: string;
  stroke?: string;
  strokeWidth?: number;
} {
  if (isNoFill(fillColor)) {
    return { fill: NO_FILL, stroke: DEFAULT_OUTLINE, strokeWidth: DEFAULT_SHAPE_STROKE_WIDTH };
  }
  return { fill: fillColor };
}

/** Stroke for lines / pens — never transparent. */
export function strokeFromFill(fillColor: string): string {
  return isNoFill(fillColor) ? DEFAULT_OUTLINE : fillColor;
}

/**
 * Quick swatches on the toolbar (2×4 grid). Full set in “More colors”.
 * No-fill is a separate swatch in the toolbar UI.
 */
export const OBJECT_COLORS = [
  '#ff5c33',
  '#ffb020',
  '#69db7c',
  '#2ee6c5',
  '#3d8bfd',
  '#ff7eb6',
  '#ffffff',
  '#12141a',
] as const;

/** Marker highlight presets for sticky / text (selection toolbar). */
export const HIGHLIGHT_COLORS = [
  '#ffe566',
  '#b8f5e8',
  '#ffc9e0',
  '#74c0fc',
  '#d0bfff',
  '#ffc9ce',
] as const;

/** Canvas background presets (null = follow Light/Dark theme default). */
export const CANVAS_BG_PRESETS: ReadonlyArray<{ id: string; label: string; value: string | null }> = [
  { id: 'theme', label: 'Theme default', value: null },
  { id: 'ink', label: 'Ink', value: '#12141a' },
  { id: 'slate', label: 'Slate', value: '#1e2430' },
  { id: 'navy', label: 'Navy', value: '#152238' },
  { id: 'paper', label: 'Paper', value: '#f3f4f7' },
  { id: 'soft', label: 'Soft gray', value: '#e8eaef' },
  { id: 'white', label: 'White', value: '#ffffff' },
  { id: 'black', label: 'Black', value: '#000000' },
  { id: 'mint', label: 'Mint wash', value: '#e6f7f2' },
  { id: 'blush', label: 'Blush', value: '#fcecef' },
];

/** Expanded board palette + custom picker. */
export const PALETTE_SWATCHES = [
  '#12141a',
  '#ffffff',
  '#f3f4f7',
  '#e8eaef',
  '#ff5c33',
  '#e04824',
  '#ffb020',
  '#ffe8a3',
  '#ff7eb6',
  '#ffc9e0',
  '#2ee6c5',
  '#1bb89c',
  '#b8f5e8',
  '#3d8bfd',
  '#74c0fc',
  '#1a3a6b',
  '#7c6cff',
  '#b197fc',
  '#69db7c',
  '#ffa94d',
  '#ff5c6a',
  '#ced4da',
  '#495057',
  '#212529',
] as const;

export const STICKY_COLORS = ['#ffb020', '#ff7eb6', '#74c0fc', '#b8f5e8', '#ffc9e0', '#ffe8a3'] as const;

export const CANVAS_BG_DARK = GRAVITY.ink;
export const CANVAS_BG_LIGHT = GRAVITY.paperSoft;
export const GRID_DOT_DARK = 'rgba(255,255,255,0.11)';
export const GRID_DOT_LIGHT = 'rgba(18,20,26,0.12)';

export const SELECTION_STROKE = GRAVITY.link;

/** Grid dots that stay visible on an arbitrary canvas fill. */
export function gridDotForBackground(bg: string): string {
  const hex = bg.replace('#', '');
  if (hex.length !== 6) return GRID_DOT_DARK;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.55 ? GRID_DOT_LIGHT : GRID_DOT_DARK;
}

/** @deprecated use canvasThemeColors() */
export const CANVAS_BG = CANVAS_BG_DARK;
export const GRID_DOT_COLOR = GRID_DOT_DARK;
