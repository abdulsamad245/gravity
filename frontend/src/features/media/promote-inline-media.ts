import { TX_ORIGIN_MEDIA_PROMOTE } from '../../shared/constants/media.constants';
import { logger } from '../../shared/logging/logger';
import type { CanvasObject } from '../../shared/types';
import type { RoomConnection } from '../collaboration/RoomConnection';
import { isInlineDataUrl, mimeFromDataUrl } from './inline-data-url';
import { persistDataUrl } from './persist-media';

export { isInlineDataUrl, mimeFromDataUrl } from './inline-data-url';

const inFlight = new Set<string>();

/**
 * Upload inline image/audio data URLs to durable `/api/v1/media/...` storage
 * and patch the shared doc. Safe to call on reconnect; skips in-flight ids
 * and fields that another peer already promoted.
 */
export async function promoteInlineMedia(conn: RoomConnection): Promise<number> {
  if (!conn.canEdit()) return 0;

  let promoted = 0;
  const objects = conn.getAllObjects();

  for (const [id, obj] of Object.entries(objects)) {
    promoted += await promoteField(conn, id, obj, 'src');
    promoted += await promoteField(conn, id, obj, 'audio');
  }

  return promoted;
}

async function promoteField(
  conn: RoomConnection,
  id: string,
  obj: CanvasObject,
  field: 'src' | 'audio',
): Promise<number> {
  const value = obj[field];
  if (!isInlineDataUrl(value)) return 0;

  const key = `${conn.roomId}:${id}:${field}`;
  if (inFlight.has(key)) return 0;
  inFlight.add(key);

  try {
    const stored = await persistDataUrl(value!, mimeFromDataUrl(value!));
    if (!stored || stored === value || stored.startsWith('data:')) return 0;

    const current = conn.getObject(id);
    if (!current || !isInlineDataUrl(current[field])) return 0;

    conn.updateObject(id, { [field]: stored }, TX_ORIGIN_MEDIA_PROMOTE);
    logger.info('Promoted offline media to durable URL', { id, field });
    return 1;
  } catch (error) {
    logger.warn('Could not promote inline media', { id, field, error });
    return 0;
  } finally {
    inFlight.delete(key);
  }
}
