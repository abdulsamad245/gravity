import { nanoid } from 'nanoid';
import { DEFAULTS, OBJECT_ID_LENGTH } from '../../shared/constants/canvas.constants';
import { GRAVITY } from '../../shared/constants/colors.constants';
import type { CanvasObject } from '../../shared/types';
import type { RoomConnection } from '../collaboration/RoomConnection';

const LEVEL_GAP = 110;
const SIBLING_GAP = 28;

/** Create a mind-map root node (`mindMapId === id`). */
export function createMindMapRoot(
  conn: RoomConnection,
  center: { x: number; y: number },
): CanvasObject {
  const id = nanoid(OBJECT_ID_LENGTH);
  return {
    id,
    type: 'rect',
    x: center.x - DEFAULTS.mindmap.width / 2,
    y: center.y - DEFAULTS.mindmap.height / 2,
    ...DEFAULTS.mindmap,
    rotation: 0,
    fill: GRAVITY.link,
    stroke: '#74c0fc',
    strokeWidth: 2,
    text: 'Central idea',
    textColor: '#ffffff',
    mindMapId: id,
    z: conn.nextZ(),
    createdBy: conn.identity.id,
  };
}

/** Add a child under `parent`; inherits map id and sets `mindMapParentId`. */
export function addMindMapChild(conn: RoomConnection, parent: CanvasObject): CanvasObject | null {
  if (!parent.mindMapId) return null;
  const siblings = Object.values(conn.getAllObjects()).filter(
    (object) => object.mindMapParentId === parent.id,
  );
  const id = nanoid(OBJECT_ID_LENGTH);
  const child: CanvasObject = {
    id,
    type: 'rect',
    x: parent.x + parent.width + LEVEL_GAP,
    y: parent.y + siblings.length * (DEFAULTS.mindmap.height + SIBLING_GAP),
    ...DEFAULTS.mindmap,
    rotation: 0,
    fill: '#1a3a6b',
    stroke: '#74c0fc',
    strokeWidth: 2,
    text: 'New idea',
    textColor: '#ffffff',
    mindMapId: parent.mindMapId,
    mindMapParentId: parent.id,
    z: conn.nextZ(),
    createdBy: conn.identity.id,
  };
  conn.addObject(child);
  return child;
}

/** True when any ancestor branch is collapsed. */
export function isMindMapBranchHidden(
  object: CanvasObject,
  objects: Record<string, CanvasObject>,
): boolean {
  let parentId = object.mindMapParentId;
  while (parentId) {
    const parent = objects[parentId];
    if (!parent) return false;
    if (parent.mindMapCollapsed) return true;
    parentId = parent.mindMapParentId;
  }
  return false;
}

/** Deterministic left-to-right tree layout for one semantic mind map. */
export function layoutMindMap(conn: RoomConnection, mindMapId: string): void {
  const all = Object.values(conn.getAllObjects()).filter((object) => object.mindMapId === mindMapId);
  const root = all.find((object) => !object.mindMapParentId);
  if (!root) return;

  const children = new Map<string, CanvasObject[]>();
  for (const object of all) {
    if (!object.mindMapParentId) continue;
    const list = children.get(object.mindMapParentId) ?? [];
    list.push(object);
    children.set(object.mindMapParentId, list);
  }
  for (const list of children.values()) list.sort((a, b) => a.y - b.y || a.id.localeCompare(b.id));

  let nextY = root.y;
  const place = (node: CanvasObject, depth: number): number => {
    const visibleChildren = node.mindMapCollapsed ? [] : (children.get(node.id) ?? []);
    if (visibleChildren.length === 0) {
      const y = nextY;
      nextY += DEFAULTS.mindmap.height + SIBLING_GAP;
      conn.updateObject(node.id, {
        x: root.x + depth * (DEFAULTS.mindmap.width + LEVEL_GAP),
        y,
      });
      return y;
    }
    const childYs = visibleChildren.map((child) => place(child, depth + 1));
    const y = (childYs[0] + childYs[childYs.length - 1]) / 2;
    conn.updateObject(node.id, {
      x: root.x + depth * (DEFAULTS.mindmap.width + LEVEL_GAP),
      y,
    });
    return y;
  };

  place(root, 0);
}
