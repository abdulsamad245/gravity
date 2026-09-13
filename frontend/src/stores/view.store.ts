import { create } from 'zustand';
import type { ViewState } from '../shared/types';

interface ViewStore extends ViewState {
  setView: (view: Partial<ViewState>) => void;
}

/**
 * The camera. Stage position/scale are controlled from here so the grid,
 * minimap, awareness viewport and follow-mode all share one source of truth.
 */
export const useViewStore = create<ViewStore>((set) => ({
  x: 0,
  y: 0,
  scale: 1,
  setView: (view) => set(view),
}));

/** Convert screen pixels to world coordinates using camera `x` / `y` / `scale`. */
export function screenToWorld(view: ViewState, sx: number, sy: number): { x: number; y: number } {
  return { x: (sx - view.x) / view.scale, y: (sy - view.y) / view.scale };
}
