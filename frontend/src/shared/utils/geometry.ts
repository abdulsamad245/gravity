import type { CanvasObject } from '../types';

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Axis-aligned union of all object footprints (rotation ignored — fine for minimap/export framing). */
export function worldBounds(objects: CanvasObject[]): Bounds | null {
  if (objects.length === 0) return null;
  const b: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const o of objects) {
    b.minX = Math.min(b.minX, o.x);
    b.minY = Math.min(b.minY, o.y);
    b.maxX = Math.max(b.maxX, o.x + o.width);
    b.maxY = Math.max(b.maxY, o.y + o.height);
  }
  return b;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
