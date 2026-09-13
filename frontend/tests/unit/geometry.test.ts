import { describe, expect, it } from 'vitest';
import { clamp, worldBounds } from '../../src/shared/utils/geometry';
import type { CanvasObject } from '../../src/shared/types';

const obj = (x: number, y: number, w: number, h: number): CanvasObject => ({
  id: 'id',
  type: 'rect',
  x,
  y,
  width: w,
  height: h,
  rotation: 0,
  fill: '#fff',
  z: 0,
});

describe('worldBounds', () => {
  it('returns null for an empty canvas', () => {
    expect(worldBounds([])).toBeNull();
  });

  it('computes the union of object footprints', () => {
    const b = worldBounds([obj(0, 0, 10, 10), obj(-50, 20, 10, 100)]);
    expect(b).toEqual({ minX: -50, minY: 0, maxX: 10, maxY: 120 });
  });
});

describe('clamp', () => {
  it('clamps below, inside and above the range', () => {
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(99, 0, 10)).toBe(10);
  });
});
