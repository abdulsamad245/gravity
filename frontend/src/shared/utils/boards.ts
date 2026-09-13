import { loadIdentity } from './identity';

/** Local board index scoped to the current guest identity (this tab). */

export const DEFAULT_BOARD_NAME = 'Untitled room';
export const PENDING_TEMPLATE_KEY = 'gravity.pendingTemplate';

export interface BoardEntry {
  id: string;
  name: string;
  updatedAt: number;
  /** Last time this guest opened the board. */
  openedAt: number;
  starred: boolean;
  ownerName: string;
}

const LEGACY_KEY = 'gravity.boards';

function ownerId(): string | null {
  return loadIdentity()?.id ?? null;
}

function storageKey(id: string): string {
  return `gravity.boards.v2.${id}`;
}

function normalize(raw: unknown, fallbackOwner: string): BoardEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const b = raw as Partial<BoardEntry> & { id?: string; name?: string };
  if (typeof b.id !== 'string' || typeof b.name !== 'string') return null;
  const updatedAt = typeof b.updatedAt === 'number' ? b.updatedAt : 0;
  return {
    id: b.id,
    name: b.name.trim() || DEFAULT_BOARD_NAME,
    updatedAt,
    openedAt: typeof b.openedAt === 'number' ? b.openedAt : updatedAt,
    starred: Boolean(b.starred),
    ownerName: typeof b.ownerName === 'string' && b.ownerName ? b.ownerName : fallbackOwner,
  };
}

function readAll(): BoardEntry[] {
  const oid = ownerId();
  if (!oid) return [];
  const owner = loadIdentity()?.name ?? 'You';
  try {
    const key = storageKey(oid);
    let raw = localStorage.getItem(key);
    // One-time migrate shared legacy list into this guest's shelf.
    if (!raw) {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        localStorage.setItem(key, legacy);
        localStorage.removeItem(LEGACY_KEY);
        raw = legacy;
      }
    }
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];
    return parsed.map((b) => normalize(b, owner)).filter((b): b is BoardEntry => !!b);
  } catch {
    return [];
  }
}

function writeAll(boards: BoardEntry[]): void {
  const oid = ownerId();
  if (!oid) return;
  try {
    localStorage.setItem(storageKey(oid), JSON.stringify(boards));
  } catch {
    /* private mode */
  }
}

export function listBoards(): BoardEntry[] {
  return readAll().sort((a, b) => (b.openedAt || b.updatedAt) - (a.openedAt || a.updatedAt));
}

export function listStarredBoards(): BoardEntry[] {
  return listBoards().filter((b) => b.starred);
}

export function getBoardName(id: string): string | null {
  return readAll().find((b) => b.id === id)?.name ?? null;
}

export function upsertBoard(id: string, name?: string): BoardEntry | null {
  const identity = loadIdentity();
  if (!identity) return null;
  const boards = readAll();
  const existing = boards.find((b) => b.id === id);
  const now = Date.now();
  const entry: BoardEntry = {
    id,
    name: (name?.trim() || existing?.name || DEFAULT_BOARD_NAME).slice(0, 80),
    updatedAt: now,
    openedAt: now,
    starred: existing?.starred ?? false,
    ownerName: identity.name,
  };
  writeAll([entry, ...boards.filter((b) => b.id !== id)]);
  return entry;
}

export function renameBoardLocal(id: string, name: string): void {
  const trimmed = name.trim().slice(0, 80) || DEFAULT_BOARD_NAME;
  const boards = readAll();
  const existing = boards.find((b) => b.id === id);
  if (!existing) {
    upsertBoard(id, trimmed);
    return;
  }
  writeAll([
    { ...existing, name: trimmed, updatedAt: Date.now() },
    ...boards.filter((b) => b.id !== id),
  ]);
}

export function setBoardStarred(id: string, starred: boolean): void {
  const boards = readAll();
  const existing = boards.find((b) => b.id === id);
  if (!existing) return;
  writeAll([{ ...existing, starred }, ...boards.filter((b) => b.id !== id)]);
}

/** Remove from this guest's list only (does not delete the shared room). */
export function removeBoard(id: string): void {
  writeAll(readAll().filter((b) => b.id !== id));
}

export function formatBoardAge(updatedAt: number): string {
  const sec = Math.max(0, Math.floor((Date.now() - updatedAt) / 1000));
  if (sec < 60) return 'Just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return 'Today';
  if (hr < 48) return 'Yesterday';
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(updatedAt).toLocaleDateString();
}

export function setPendingTemplate(templateId: string): void {
  try {
    sessionStorage.setItem(PENDING_TEMPLATE_KEY, templateId);
  } catch {
    /* ignore */
  }
}

export function consumePendingTemplate(): string | null {
  try {
    const id = sessionStorage.getItem(PENDING_TEMPLATE_KEY);
    if (id) sessionStorage.removeItem(PENDING_TEMPLATE_KEY);
    return id;
  } catch {
    return null;
  }
}
