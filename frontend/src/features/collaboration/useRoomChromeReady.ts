import { useEffect, useState } from 'react';
import { ROOM_CHROME_SETTLE_MS, ROOM_SYNC_WAIT_MAX_MS } from '../../shared/constants/motion.constants';
import type { RoomConnection } from './RoomConnection';

/**
 * True once local room persistence has synced (or the wait capped) and a short
 * settle has elapsed. Used to delay first-run overlays so they ease in after
 * chrome and board state are ready.
 *
 * Allowance: sync wait up to 900ms, then 420ms settle (~0.4–1.3s typical).
 */
export function useRoomChromeReady(conn: RoomConnection): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let settleTimer = 0;
    let syncTimer = 0;
    setReady(false);

    const finishAfterSettle = () => {
      if (cancelled || settleTimer) return;
      settleTimer = window.setTimeout(() => {
        if (!cancelled) setReady(true);
      }, ROOM_CHROME_SETTLE_MS);
    };

    const onSynced = () => {
      window.clearTimeout(syncTimer);
      finishAfterSettle();
    };

    if (conn.persistence.synced) {
      finishAfterSettle();
    } else {
      conn.persistence.once('synced', onSynced);
      // Cap wait so a stuck persistence layer cannot block the UI forever.
      syncTimer = window.setTimeout(onSynced, ROOM_SYNC_WAIT_MAX_MS);
    }

    return () => {
      cancelled = true;
      window.clearTimeout(syncTimer);
      window.clearTimeout(settleTimer);
      conn.persistence.off('synced', onSynced);
    };
  }, [conn]);

  return ready;
}
