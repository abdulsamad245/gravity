import { nanoid } from 'nanoid';
import { OBJECT_ID_LENGTH } from '../../shared/constants/canvas.constants';
import type { CanvasObject } from '../../shared/types';
import { normalizeVotes } from '../../shared/utils/votes';
import { exportedDocumentSchema } from '../../shared/validation/canvas-object.schema';
import type { RoomConnection } from '../collaboration/RoomConnection';

export type ImportResult =
  | { ok: true; count: number }
  | { ok: false; error: string };

/**
 * Import a Gravity JSON board into the live Y.Doc.
 *
 * JSON is an interop snapshot, not CRDT history (Yjs recommends
 * `Y.encodeStateAsUpdate` for durable merge). Import validates the snapshot,
 * mints new object ids, and `addObject`s with `TX_ORIGIN_LOCAL` so peers and
 * IndexedDB receive normal local writes.
 *
 * Import once as a user action; do not re-apply on every client join.
 */
export async function importBoardJSON(file: File, conn: RoomConnection): Promise<ImportResult> {
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, error: 'Could not read that file.' };
  }

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'File is not valid JSON.' };
  }

  const parsed = exportedDocumentSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: 'JSON does not match a Gravity board export.' };
  }

  const idMap = new Map<string, string>();
  for (const o of parsed.data.objects) {
    idMap.set(o.id, nanoid(OBJECT_ID_LENGTH));
  }

  const baseZ = conn.nextZ();
  let i = 0;
  for (const o of parsed.data.objects) {
    const next: CanvasObject = {
      ...o,
      id: idMap.get(o.id)!,
      fromId: o.fromId ? idMap.get(o.fromId) : undefined,
      toId: o.toId ? idMap.get(o.toId) : undefined,
      votes: o.votes ? normalizeVotes(o.votes) : undefined,
      z: baseZ + i,
      createdBy: conn.identity.id,
      impulse: null,
    };
    // Drop dangling connector ends that pointed outside the file.
    if (o.fromId && !next.fromId) delete next.fromId;
    if (o.toId && !next.toId) delete next.toId;
    conn.addObject(next);
    i += 1;
  }

  return { ok: true, count: parsed.data.objects.length };
}
