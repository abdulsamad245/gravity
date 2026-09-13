import type { IncomingMessage } from 'http';
import type { Server } from 'http';
import { WebSocketServer, type WebSocket } from 'ws';
import { setupWSConnection, docs, setPersistence } from 'y-websocket/bin/utils';
import { ROOM_NAME_REGEX, WS_PATH_PREFIX } from '../constants/app.constants';
import { replayLogService } from '../services/replay-log.service';
import { roomPersistenceService } from '../services/room-persistence.service';
import { logger } from '../observability/logger';

/**
 * Real-time sync: one Yjs document per room via y-websocket. Room name is
 * the URL path; optional `/ws` prefix is stripped for local and Nginx setups.
 *
 * Upgrade accepts optional `?token=` — ignored in guest mode; verify here
 * when JWT auth is added (WebSocket half of the auth seam).
 */
export function createYjsWebSocketServer(server: Server): WebSocketServer {
  setPersistence(roomPersistenceService);
  const wss = new WebSocketServer({ noServer: true });

  wss.on('connection', (conn: WebSocket, req: IncomingMessage) => {
    const roomName = parseRoomName(req.url ?? '');
    if (!roomName) {
      conn.close(4400, 'Invalid room name');
      return;
    }

    setupWSConnection(conn, req, { docName: roomName });

    const doc = docs.get(roomName);
    if (doc) {
      replayLogService.attach(roomName, doc);
      logger.info({ room: roomName, clients: doc.conns.size }, 'Client joined room');
      conn.on('close', () => {
        logger.info({ room: roomName, clients: doc.conns.size }, 'Client left room');
      });
    }
  });

  server.on('upgrade', (req, socket, head) => {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  return wss;
}

/** Extracts and validates the room name from an upgrade request URL. */
export function parseRoomName(url: string): string | null {
  let path = url.split('?')[0];
  if (path.startsWith(WS_PATH_PREFIX + '/')) path = path.slice(WS_PATH_PREFIX.length);
  const room = path.replace(/^\//, '');
  return ROOM_NAME_REGEX.test(room) ? room : null;
}
