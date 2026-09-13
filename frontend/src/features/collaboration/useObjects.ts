import { useEffect, useState } from 'react';
import type * as Y from 'yjs';
import type { CanvasObject } from '../../shared/types';

/**
 * Yjs objects map → React state with per-key reference stability: only
 * changed keys get new object references so memoized nodes skip untouched
 * items (needed at ~30Hz physics sync). Works for live and replay docs.
 */
export function useObjects(objectsMap: Y.Map<Y.Map<unknown>>): Record<string, CanvasObject> {
  const [objects, setObjects] = useState<Record<string, CanvasObject>>({});

  useEffect(() => {
    const readAll = (): Record<string, CanvasObject> => {
      const out: Record<string, CanvasObject> = {};
      objectsMap.forEach((v, k) => {
        out[k] = v.toJSON() as CanvasObject;
      });
      return out;
    };

    const handler = (events: Y.YEvent<Y.Map<unknown>>[]) => {
      // IMPORTANT: e.changes must be computed HERE, synchronously — Yjs
      // forbids reading it after the event handler returns (and React runs
      // state updater functions later, at render time).
      const changed = new Set<string>();
      const deleted = new Set<string>();
      for (const e of events) {
        if (e.target === objectsMap) {
          // Top-level: objects added or removed.
          e.changes.keys.forEach((change, key) => {
            if (change.action === 'delete') deleted.add(key);
            else changed.add(key);
          });
        } else {
          // Nested: a field changed — path[0] is the object id.
          const id = e.path[0];
          if (typeof id === 'string') changed.add(id);
        }
      }
      setObjects((prev) => {
        const next = { ...prev };
        for (const id of deleted) delete next[id];
        for (const id of changed) {
          const m = objectsMap.get(id);
          if (m) next[id] = m.toJSON() as CanvasObject;
        }
        return next;
      });
    };

    setObjects(readAll());
    objectsMap.observeDeep(handler);
    return () => objectsMap.unobserveDeep(handler);
  }, [objectsMap]);

  return objects;
}
