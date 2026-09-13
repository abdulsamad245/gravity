export const FONT_OPTIONS = [
  { id: 'dm-sans', label: 'DM Sans', stack: 'DM Sans, system-ui, sans-serif' },
  { id: 'system', label: 'System', stack: 'system-ui, -apple-system, sans-serif' },
  { id: 'serif', label: 'Serif', stack: 'Georgia, "Times New Roman", serif' },
  { id: 'mono', label: 'Mono', stack: 'ui-monospace, "Cascadia Code", Consolas, monospace' },
  { id: 'rounded', label: 'Rounded', stack: '"Trebuchet MS", "Segoe UI", sans-serif' },
  { id: 'impact', label: 'Display', stack: 'Impact, Haettenschweiler, sans-serif' },
] as const;

export type FontOptionId = (typeof FONT_OPTIONS)[number]['id'];

export const DEFAULT_FONT_STACK = FONT_OPTIONS[0].stack;

/** Color-emoji capable stack for stamp / sticker glyphs (Konva canvas + SVG). */
export const EMOJI_FONT_STACK =
  '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif';

export type TextAlign = 'left' | 'center' | 'right';

export function fontStackFor(family?: string): string {
  if (!family) return DEFAULT_FONT_STACK;
  const hit = FONT_OPTIONS.find((f) => f.stack === family || f.id === family || f.label === family);
  return hit?.stack ?? family;
}

export function fontLabelFor(family?: string): string {
  const stack = fontStackFor(family);
  return FONT_OPTIONS.find((f) => f.stack === stack)?.label ?? 'Custom';
}
