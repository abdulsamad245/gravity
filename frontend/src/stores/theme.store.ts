import { create } from 'zustand';
import {
  CANVAS_BG_DARK,
  CANVAS_BG_LIGHT,
  GRID_DOT_DARK,
  GRID_DOT_LIGHT,
  gridDotForBackground,
} from '../shared/constants/colors.constants';

/** User preference: explicit light/dark, or follow OS. */
export type ThemePreference = 'light' | 'dark' | 'system';
/** Resolved theme applied to the DOM and Konva. */
export type ResolvedTheme = 'light' | 'dark';

const THEME_KEY = 'gravity.theme';

function systemTheme(): ResolvedTheme {
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function resolve(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? systemTheme() : preference;
}

function detectInitial(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === 'dark' || saved === 'light' || saved === 'system') return saved;
  } catch {
    /* private mode */
  }
  return 'system';
}

interface ThemeState {
  preference: ThemePreference;
  resolved: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
}

function applyDom(resolved: ResolvedTheme): void {
  document.documentElement.dataset.theme = resolved;
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const preference = typeof window !== 'undefined' ? detectInitial() : 'system';
  const resolved = typeof window !== 'undefined' ? resolve(preference) : 'dark';
  if (typeof window !== 'undefined') {
    applyDom(resolved);
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      if (get().preference !== 'system') return;
      const next = systemTheme();
      applyDom(next);
      set({ resolved: next });
    });
  }
  return {
    preference,
    resolved,
    setPreference: (next) => {
      const resolvedNext = resolve(next);
      applyDom(resolvedNext);
      try {
        localStorage.setItem(THEME_KEY, next);
      } catch {
        /* ignore */
      }
      set({ preference: next, resolved: resolvedNext });
    },
  };
});

/** Canvas colors that Konva cannot read from CSS variables. */
export function canvasThemeColors(theme: ResolvedTheme, canvasBgOverride?: string | null) {
  if (canvasBgOverride) {
    return { bg: canvasBgOverride, grid: gridDotForBackground(canvasBgOverride) };
  }
  return theme === 'light'
    ? { bg: CANVAS_BG_LIGHT, grid: GRID_DOT_LIGHT }
    : { bg: CANVAS_BG_DARK, grid: GRID_DOT_DARK };
}
