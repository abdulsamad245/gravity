import { TOOLS, type ToolId } from '../../shared/constants/object-types';
import { ZOOM_MAX, ZOOM_MIN } from '../../shared/constants/canvas.constants';

/**
 * Per-tab room UI restore (camera, selection, tool, Orbit open).
 * sessionStorage: same tab refresh returns you where you were; new tab starts clean.
 * Keyed by room + identity so users/rooms never mix.
 */
export type RoomSessionSnapshot = {
  version: 1;
  view: { x: number; y: number; scale: number };
  selectedIds: string[];
  tool: ToolId;
  orbitOpen: boolean;
  updatedAt: number;
};

const STORE_VERSION = 1 as const;
const MAX_SELECTED = 40;

function storageKey(roomId: string, userId: string): string {
  return `gravity.room.session.v1:${roomId}:${userId}`;
}

function isToolId(value: unknown): value is ToolId {
  return typeof value === 'string' && (TOOLS as readonly string[]).includes(value);
}

function sanitizeView(raw: unknown): RoomSessionSnapshot['view'] | null {
  if (!raw || typeof raw !== 'object') return null;
  const v = raw as Record<string, unknown>;
  const x = Number(v.x);
  const y = Number(v.y);
  const scale = Number(v.scale);
  if (![x, y, scale].every((n) => Number.isFinite(n))) return null;
  return {
    x: Math.max(-1e7, Math.min(1e7, x)),
    y: Math.max(-1e7, Math.min(1e7, y)),
    scale: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, scale)),
  };
}

export function loadRoomSession(roomId: string, userId: string): RoomSessionSnapshot | null {
  if (!roomId || !userId) return null;
  try {
    const raw = sessionStorage.getItem(storageKey(roomId, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RoomSessionSnapshot>;
    if (parsed?.version !== STORE_VERSION) return null;
    const view = sanitizeView(parsed.view);
    if (!view) return null;
    const selectedIds = Array.isArray(parsed.selectedIds)
      ? parsed.selectedIds
          .filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 64)
          .slice(0, MAX_SELECTED)
      : [];
    return {
      version: STORE_VERSION,
      view,
      selectedIds,
      tool: isToolId(parsed.tool) ? parsed.tool : 'select',
      orbitOpen: parsed.orbitOpen === true,
      updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : Date.now(),
    };
  } catch {
    return null;
  }
}

export function persistRoomSession(
  roomId: string,
  userId: string,
  patch: {
    view: { x: number; y: number; scale: number };
    selectedIds: string[];
    tool: ToolId;
    orbitOpen: boolean;
  },
): void {
  if (!roomId || !userId) return;
  const view = sanitizeView(patch.view);
  if (!view) return;
  const snapshot: RoomSessionSnapshot = {
    version: STORE_VERSION,
    view,
    selectedIds: patch.selectedIds.filter(Boolean).slice(0, MAX_SELECTED),
    tool: isToolId(patch.tool) ? patch.tool : 'select',
    orbitOpen: !!patch.orbitOpen,
    updatedAt: Date.now(),
  };
  try {
    sessionStorage.setItem(storageKey(roomId, userId), JSON.stringify(snapshot));
  } catch {
    /* private mode / quota */
  }
}
