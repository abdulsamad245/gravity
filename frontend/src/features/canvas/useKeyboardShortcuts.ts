import { useEffect } from 'react';
import { nanoid } from 'nanoid';
import { NUDGE_STEP, NUDGE_STEP_SHIFT, OBJECT_ID_LENGTH } from '../../shared/constants/canvas.constants';
import type { ToolId } from '../../shared/types';
import { screenToWorld, useViewStore } from '../../stores/view.store';
import { useUiStore } from '../../stores/ui.store';
import type { RoomConnection } from '../collaboration/RoomConnection';

const TOOL_KEYS: Record<string, ToolId> = {
  v: 'select',
  h: 'hand',
  p: 'pen',
  u: 'highlighter',
  e: 'eraser',
  r: 'rect',
  o: 'ellipse',
  s: 'sticky',
  t: 'text',
  q: 'code',
  f: 'frame',
  b: 'table',
  c: 'connector',
  g: 'rope',
  l: 'line',
  k: 'laser',
  m: 'stamp',
  n: 'comment',
  a: 'attract',
  w: 'wind',
  x: 'repel',
  j: 'magnet',
  z: 'archiveWell',
  '1': 'triangle',
  '2': 'diamond',
  '3': 'star',
  '4': 'hexagon',
  '5': 'arrow',
};

function selectedIds(ui: ReturnType<typeof useUiStore.getState>): string[] {
  if (ui.selectedIds.length) return ui.selectedIds;
  return ui.selectedId ? [ui.selectedId] : [];
}

function pasteClipboard(conn: RoomConnection, at: { x: number; y: number }): void {
  const ui = useUiStore.getState();
  const items = ui.clipboard;
  if (!items.length) return;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const o of items) {
    minX = Math.min(minX, o.x);
    minY = Math.min(minY, o.y);
    maxX = Math.max(maxX, o.x + o.width);
    maxY = Math.max(maxY, o.y + o.height);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const created: string[] = [];

  for (const src of items) {
    const copy = {
      ...src,
      id: nanoid(OBJECT_ID_LENGTH),
      x: at.x + (src.x - cx),
      y: at.y + (src.y - cy),
      z: conn.nextZ(),
      impulse: null,
      createdBy: conn.identity.id,
    };
    conn.addObject(copy);
    created.push(copy.id);
  }
  if (created.length) ui.setSelectedIds(created);
}

/**
 * Global keyboard shortcuts. Inactive while a text field has focus or
 * the canvas is in replay mode.
 */
export function useKeyboardShortcuts(conn: RoomConnection, enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      const ui = useUiStore.getState();
      const key = e.key.toLowerCase();
      const mod = e.ctrlKey || e.metaKey;

      if (mod) {
        if (key === 'z') {
          e.preventDefault();
          if (e.shiftKey) conn.undoManager.redo();
          else conn.undoManager.undo();
          return;
        }
        if (key === 'y') {
          e.preventDefault();
          conn.undoManager.redo();
          return;
        }
        if (key === 'a') {
          e.preventDefault();
          const ids = Object.keys(conn.getAllObjects()).filter((id) => {
            const o = conn.getObject(id);
            return !!o && o.type !== 'connector' && o.type !== 'rope';
          });
          ui.setSelectedIds(ids);
          return;
        }
        if (key === 'c') {
          const ids = selectedIds(ui);
          if (!ids.length) return;
          e.preventDefault();
          const items = ids
            .map((id) => conn.getObject(id))
            .filter((o): o is NonNullable<typeof o> => !!o)
            .map((o) => ({ ...o }));
          if (items.length) ui.setClipboard(items);
          return;
        }
        if (key === 'x') {
          const ids = selectedIds(ui);
          if (!ids.length) return;
          e.preventDefault();
          const items: NonNullable<ReturnType<typeof conn.getObject>>[] = [];
          for (const id of ids) {
            const o = conn.getObject(id);
            if (!o || o.locked || !conn.canDeleteObject(id)) continue;
            items.push({ ...o });
          }
          if (!items.length) return;
          ui.setClipboard(items);
          for (const o of items) conn.deleteObject(o.id);
          ui.setSelectedId(null);
          return;
        }
        if (key === 'v') {
          if (!ui.clipboard.length) return;
          e.preventDefault();
          const view = useViewStore.getState();
          const at = screenToWorld(view, window.innerWidth / 2, window.innerHeight / 2);
          pasteClipboard(conn, at);
          return;
        }
        if (key === 'd') {
          const ids = selectedIds(ui);
          if (!ids.length) return;
          e.preventDefault();
          const created: string[] = [];
          for (const id of ids) {
            const obj = conn.getObject(id);
            if (!obj) continue;
            const copy = {
              ...obj,
              id: nanoid(OBJECT_ID_LENGTH),
              x: obj.x + 24,
              y: obj.y + 24,
              z: conn.nextZ(),
              impulse: null,
              createdBy: conn.identity.id,
            };
            conn.addObject(copy);
            created.push(copy.id);
          }
          if (created.length) ui.setSelectedIds(created);
          return;
        }
        if (key === ']' || key === '[') {
          const ids = selectedIds(ui);
          if (!ids.length) return;
          e.preventDefault();
          for (const id of ids) {
            const obj = conn.getObject(id);
            if (!obj || obj.locked) continue;
            if (key === ']') conn.updateObject(id, { z: conn.nextZ() });
            else conn.updateObject(id, { z: 0 });
          }
          return;
        }
        return;
      }

      if (key === 'escape') {
        ui.setSelectedId(null);
        ui.setActiveCommentId(null);
        ui.setCommentDraft(null);
        return;
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds(ui).length) {
        e.preventDefault();
        const ids = selectedIds(ui);
        for (const id of ids) {
          const o = conn.getObject(id);
          if (o?.locked || !conn.canDeleteObject(id)) continue;
          conn.deleteObject(id);
        }
        ui.setSelectedId(null);
        return;
      }

      // Arrow nudge selected objects (Shift uses NUDGE_STEP_SHIFT)
      if (e.key.startsWith('Arrow') && selectedIds(ui).length) {
        e.preventDefault();
        const step = e.shiftKey ? NUDGE_STEP_SHIFT : NUDGE_STEP;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        for (const id of selectedIds(ui)) {
          const o = conn.getObject(id);
          if (!o || o.locked) continue;
          conn.updateObject(id, { x: o.x + dx, y: o.y + dy });
        }
        return;
      }

      const tool = TOOL_KEYS[key];
      if (tool) ui.setTool(tool);
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [conn, enabled]);
}
