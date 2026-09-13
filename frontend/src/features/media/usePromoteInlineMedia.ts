import { useEffect, useMemo, useRef } from 'react';
import type { CanvasObject } from '../../shared/types';
import type { ConnectionStatus, RoomConnection } from '../collaboration/RoomConnection';
import { isInlineDataUrl } from './inline-data-url';
import { promoteInlineMedia } from './promote-inline-media';

/**
 * When the room is online again, upload any image/audio still stored as
 * inline data URLs (created while offline or when upload failed).
 */
export function usePromoteInlineMedia(
  conn: RoomConnection,
  status: ConnectionStatus,
  objects: Record<string, CanvasObject>,
  enabled: boolean,
): void {
  const pendingInline = useMemo(
    () =>
      Object.values(objects).some(
        (obj) => isInlineDataUrl(obj.src) || isInlineDataUrl(obj.audio),
      ),
    [objects],
  );
  const runId = useRef(0);

  useEffect(() => {
    if (!enabled || status !== 'online' || !pendingInline) return;

    const myRun = ++runId.current;
    const timer = window.setTimeout(() => {
      if (runId.current !== myRun) return;
      void promoteInlineMedia(conn);
    }, 400);

    return () => {
      window.clearTimeout(timer);
    };
  }, [conn, enabled, pendingInline, status]);
}
