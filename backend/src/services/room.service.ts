import { docs } from 'y-websocket/bin/utils';

/**
 * Read-only statistics over the live room registry maintained by
 * y-websocket. Used by the health endpoint for lightweight monitoring.
 */
export class RoomService {
  roomCount(): number {
    return docs.size;
  }

  clientCount(): number {
    let total = 0;
    for (const doc of docs.values()) total += doc.conns.size;
    return total;
  }

  /** True when the room is currently loaded in the y-websocket registry. */
  isLive(roomName: string): boolean {
    return docs.has(roomName);
  }
}

export const roomService = new RoomService();
