import { useEffect, useState } from 'react';
import type * as Y from 'yjs';
import type { CanvasComment } from '../../shared/types';

/**
 * Bridges the Yjs comments map into React state with per-key reference
 * stability (same contract as useObjects).
 */
export function useComments(commentsMap: Y.Map<Y.Map<unknown>>): Record<string, CanvasComment> {
  const [comments, setComments] = useState<Record<string, CanvasComment>>({});

  useEffect(() => {
    const readAll = (): Record<string, CanvasComment> => {
      const out: Record<string, CanvasComment> = {};
      commentsMap.forEach((v, k) => {
        out[k] = normalizeComment(k, v.toJSON());
      });
      return out;
    };

    const handler = (events: Y.YEvent<Y.Map<unknown>>[]) => {
      // Same as useObjects: read e.changes synchronously inside the observer (Yjs requirement).
      const changed = new Set<string>();
      const deleted = new Set<string>();
      for (const e of events) {
        if (e.target === commentsMap) {
          e.changes.keys.forEach((change, key) => {
            if (change.action === 'delete') deleted.add(key);
            else changed.add(key);
          });
        } else {
          const id = e.path[0];
          if (typeof id === 'string') changed.add(id);
        }
      }
      setComments((prev) => {
        const next = { ...prev };
        for (const id of deleted) delete next[id];
        for (const id of changed) {
          const m = commentsMap.get(id);
          if (m) next[id] = normalizeComment(id, m.toJSON());
        }
        return next;
      });
    };

    setComments(readAll());
    commentsMap.observeDeep(handler);
    return () => commentsMap.unobserveDeep(handler);
  }, [commentsMap]);

  return comments;
}

function normalizeComment(id: string, raw: unknown): CanvasComment {
  const c = (raw ?? {}) as Partial<CanvasComment>;
  return {
    id,
    x: typeof c.x === 'number' ? c.x : 0,
    y: typeof c.y === 'number' ? c.y : 0,
    ox: typeof c.ox === 'number' ? c.ox : 0,
    oy: typeof c.oy === 'number' ? c.oy : 0,
    targetId: typeof c.targetId === 'string' ? c.targetId : null,
    resolved: !!c.resolved,
    messages: Array.isArray(c.messages) ? c.messages : [],
  };
}
