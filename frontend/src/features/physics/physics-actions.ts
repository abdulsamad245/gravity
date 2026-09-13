import { nanoid } from 'nanoid';
import { OBJECT_ID_LENGTH } from '../../shared/constants/canvas.constants';
import { GRAVITY } from '../../shared/constants/colors.constants';
import { PHYSICS } from '../../shared/constants/physics.constants';
import type { CanvasObject } from '../../shared/types';
import { useUiStore } from '../../stores/ui.store';
import { useViewStore } from '../../stores/view.store';
import type { RoomConnection } from '../collaboration/RoomConnection';

/** Viewport center in world coordinates (for placing facilitation objects). */
export function viewportCenterWorld(): { x: number; y: number } {
  const { x, y, scale } = useViewStore.getState();
  return {
    x: (-x + window.innerWidth / 2) / scale,
    y: (-y + window.innerHeight / 2) / scale,
  };
}

/** Place a topic magnet that pulls nearby physics objects into a cluster. */
export function placeMagnet(conn: RoomConnection, at?: { x: number; y: number }): string {
  const center = at ?? viewportCenterWorld();
  const size = PHYSICS.MAGNET_SIZE;
  const id = nanoid(OBJECT_ID_LENGTH);
  conn.addObject({
    id,
    type: 'ellipse',
    x: center.x - size / 2,
    y: center.y - size / 2,
    width: size,
    height: size,
    rotation: 0,
    fill: GRAVITY.flare,
    text: 'Magnet',
    textColor: '#fff',
    fontSize: 13,
    align: 'center',
    role: 'magnet',
    locked: true,
    physics: false,
    z: conn.nextZ(),
    createdBy: conn.identity.id,
  });
  return id;
}

/** Place an archive well that pulls objects in and parks them. */
export function placeArchiveWell(conn: RoomConnection, at?: { x: number; y: number }): string {
  const center = at ?? viewportCenterWorld();
  const w = PHYSICS.ARCHIVE_WELL_WIDTH;
  const h = PHYSICS.ARCHIVE_WELL_HEIGHT;
  const id = nanoid(OBJECT_ID_LENGTH);
  conn.addObject({
    id,
    type: 'frame',
    x: center.x - w / 2,
    y: center.y - h / 2,
    width: w,
    height: h,
    rotation: 0,
    fill: 'rgba(28, 31, 40, 0.55)',
    stroke: GRAVITY.danger,
    strokeWidth: 2,
    text: 'Archive well',
    textColor: '#ffc9ce',
    fontSize: 14,
    role: 'archiveWell',
    locked: false,
    physics: false,
    z: conn.nextZ(),
    createdBy: conn.identity.id,
  });
  return id;
}

/** Broadcast a short shake burst around the viewport center. */
export function triggerBoardShake(conn: RoomConnection, strength = 1): void {
  const center = viewportCenterWorld();
  conn.setPresence({
    shake: { at: Date.now(), x: center.x, y: center.y, strength },
  });
  window.setTimeout(() => {
    const local = conn.awareness.getLocalState() as { shake?: { at: number } | null } | null;
    if (local?.shake && Date.now() - local.shake.at >= PHYSICS.SHAKE_DURATION_MS) {
      conn.setPresence({ shake: null });
    }
  }, PHYSICS.SHAKE_DURATION_MS + 50);
}

/**
 * Lay selected (or all unlocked physics) objects into a grid and zero velocities.
 * Pure kinematic write; works offline without being physics host.
 */
export function settleObjects(conn: RoomConnection, ids?: string[]): number {
  const selected = useUiStore.getState().selectedIds;
  const all = conn.getAllObjects();
  const targetIds =
    ids ??
    (selected.length > 0
      ? selected
      : Object.keys(all).filter((id) => {
          const o = all[id]!;
          return (
            !!o.physics &&
            !o.locked &&
            !o.archived &&
            o.type !== 'connector' &&
            o.type !== 'rope' &&
            o.role !== 'magnet' &&
            o.role !== 'archiveWell'
          );
        }));

  const items = targetIds
    .map((id) => all[id])
    .filter((o): o is CanvasObject => !!o && o.type !== 'connector' && o.type !== 'rope');
  if (items.length === 0) return 0;

  const cols = Math.min(PHYSICS.SETTLE_COLS, Math.max(1, Math.ceil(Math.sqrt(items.length))));
  const cellW = Math.max(...items.map((o) => o.width)) + PHYSICS.SETTLE_GAP;
  const cellH = Math.max(...items.map((o) => o.height)) + PHYSICS.SETTLE_GAP;
  const originX = Math.min(...items.map((o) => o.x));
  const originY = Math.min(...items.map((o) => o.y));

  items
    .slice()
    .sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x)
    .forEach((obj, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      conn.updateObject(obj.id, {
        x: originX + col * cellW,
        y: originY + row * cellH,
        rotation: 0,
        impulse: null,
        physics: true,
      });
    });

  return items.length;
}

/** Convert the selected object into a topic magnet (or clear magnet role). */
export function toggleMagnetRole(conn: RoomConnection, id: string): void {
  const obj = conn.getObject(id);
  if (!obj) return;
  if (obj.role === 'magnet') {
    conn.updateObject(id, { role: undefined, locked: false, text: obj.text === 'Magnet' ? '' : obj.text });
    return;
  }
  conn.updateObject(id, {
    role: 'magnet',
    locked: true,
    physics: false,
    impulse: null,
    text: obj.text?.trim() ? obj.text : 'Magnet',
  });
}
