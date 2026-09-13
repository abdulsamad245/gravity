import { useEffect } from 'react';
import { useUiStore } from '../../stores/ui.store';
import type { RoomConnection } from '../collaboration/RoomConnection';

/**
 * Board gravity is shared over awareness (last write wins).
 * Needed because only the physics host steps Matter.js — a local-only
 * toggle on a non-host client would do nothing.
 */
export function useBoardGravitySync(conn: RoomConnection): void {
  const boardGravity = useUiStore((s) => s.boardGravity);
  const setBoardGravity = useUiStore((s) => s.setBoardGravity);

  useEffect(() => {
    const sync = () => {
      const states = conn.awareness.getStates() as Map<
        number,
        { boardGravity?: boolean; boardGravityAt?: number }
      >;
      let bestOn: boolean | null = null;
      let bestAt = -1;
      states.forEach((s) => {
        if (typeof s?.boardGravity === 'boolean' && typeof s?.boardGravityAt === 'number') {
          if (s.boardGravityAt >= bestAt) {
            bestAt = s.boardGravityAt;
            bestOn = s.boardGravity;
          }
        }
      });
      if (bestOn !== null && bestOn !== useUiStore.getState().boardGravity) {
        setBoardGravity(bestOn);
      }
    };
    conn.awareness.on('change', sync);
    sync();
    return () => {
      conn.awareness.off('change', sync);
    };
  }, [conn, setBoardGravity]);

  // Keep local presence in sync when this client toggles gravity.
  useEffect(() => {
    const local = (conn.awareness.getLocalState() ?? {}) as {
      boardGravity?: boolean;
      boardGravityAt?: number;
    };
    if (local.boardGravity === boardGravity) return;
    conn.setPresence({ boardGravity, boardGravityAt: Date.now() });
  }, [conn, boardGravity]);
}

export function toggleBoardGravity(conn: RoomConnection): void {
  const next = !useUiStore.getState().boardGravity;
  useUiStore.getState().setBoardGravity(next);
  conn.setPresence({ boardGravity: next, boardGravityAt: Date.now() });
}
