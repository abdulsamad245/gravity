import type * as Y from 'yjs';
import type { CanvasObject } from '../../shared/types';

/** Snapshot a Yjs objects map into a plain record for offscreen export rendering. */
export function yMapToObjects(map: Y.Map<Y.Map<unknown>>): Record<string, CanvasObject> {
  const out: Record<string, CanvasObject> = {};
  map.forEach((value, id) => {
    out[id] = value.toJSON() as CanvasObject;
  });
  return out;
}
