import { nanoid } from 'nanoid';
import { roomExists } from '../api/client';
import { listBoards } from './boards';

/**
 * Generated room ids: URL-safe nanoid alphabet, long enough that accidental
 * collisions are negligible, still short enough to share aloud.
 * (64^12 ≈ 4.7e21; birthday collisions stay tiny even at huge room counts.)
 */
export const ROOM_ID_LENGTH = 12;

const MAX_ALLOCATE_ATTEMPTS = 12;

/** Sync generator: unique vs this guest's local board shelf. */
export function newRoomId(taken: ReadonlySet<string> = localTakenIds()): string {
  for (let i = 0; i < MAX_ALLOCATE_ATTEMPTS; i++) {
    const id = nanoid(ROOM_ID_LENGTH);
    if (!taken.has(id)) return id;
  }
  // Extra entropy if the local shelf somehow saturates the short space.
  return nanoid(21);
}

/**
 * Preferred for "create board" flows: also asks the server whether a durable
 * or live room already uses the id, then retries.
 */
export async function allocateUniqueRoomId(): Promise<string> {
  const taken = localTakenIds();
  for (let i = 0; i < MAX_ALLOCATE_ATTEMPTS; i++) {
    const id = newRoomId(taken);
    taken.add(id);
    try {
      const exists = await roomExists(id);
      if (!exists) return id;
    } catch {
      // Offline / API blip: length + local check is still extremely safe.
      return id;
    }
  }
  return nanoid(21);
}

function localTakenIds(): Set<string> {
  return new Set(listBoards().map((b) => b.id));
}
