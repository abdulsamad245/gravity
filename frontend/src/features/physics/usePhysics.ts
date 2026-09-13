import { useEffect, useRef } from 'react';
import type { RoomConnection } from '../collaboration/RoomConnection';
import { PhysicsController } from './PhysicsController';

/**
 * Runs the physics controller for the lifetime of a room connection.
 * Disabled during time-travel replay (the replay document is read-only).
 */
export function usePhysics(
  conn: RoomConnection,
  isHost: boolean,
  enabled: boolean,
  boardGravity = false,
): PhysicsController | null {
  const controller = useRef<PhysicsController | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const c = new PhysicsController(conn);
    controller.current = c;
    return () => {
      c.destroy();
      controller.current = null;
    };
  }, [conn, enabled]);

  useEffect(() => {
    controller.current?.setHost(isHost);
  }, [isHost, enabled]);

  useEffect(() => {
    controller.current?.setBoardGravity(boardGravity);
  }, [boardGravity, enabled]);

  return controller.current;
}
