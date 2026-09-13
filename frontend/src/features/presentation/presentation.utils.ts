import { ZOOM_MAX, ZOOM_MIN } from '../../shared/constants/canvas.constants';
import type { CanvasObject } from '../../shared/types';
import { clamp } from '../../shared/utils/geometry';
import { useViewStore } from '../../stores/view.store';

/** Frames as slides: top-to-bottom, then left-to-right. */
export function presentationFrames(objects: Record<string, CanvasObject>): CanvasObject[] {
  return Object.values(objects)
    .filter((o) => o.type === 'frame')
    .sort((a, b) => a.y - b.y || a.x - b.x || a.z - b.z || a.id.localeCompare(b.id));
}

/** Fit the camera so a frame fills the viewport with padding. */
export function fitFrameInView(frame: CanvasObject, pad = 56): void {
  const w = Math.max(1, frame.width + pad * 2);
  const h = Math.max(1, frame.height + pad * 2);
  const s = clamp(Math.min(window.innerWidth / w, window.innerHeight / h), ZOOM_MIN, ZOOM_MAX);
  useViewStore.getState().setView({
    scale: s,
    x: -frame.x * s + (window.innerWidth - frame.width * s) / 2,
    y: -frame.y * s + (window.innerHeight - frame.height * s) / 2,
  });
}

export function frameScreenRect(frame: CanvasObject): { left: number; top: number; width: number; height: number } {
  const { x, y, scale } = useViewStore.getState();
  return {
    left: frame.x * scale + x,
    top: frame.y * scale + y,
    width: frame.width * scale,
    height: frame.height * scale,
  };
}
