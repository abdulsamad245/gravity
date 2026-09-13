import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import WebSocket from 'ws';
import { e2eWsBaseUrl } from './http.js';

export type ConnectedRoom = {
  doc: Y.Doc;
  provider: WebsocketProvider;
  destroy: () => void;
};

export async function connectYjsRoom(
  roomId: string,
  options?: { params?: Record<string, string> },
): Promise<ConnectedRoom> {
  const doc = new Y.Doc();
  const provider = new WebsocketProvider(e2eWsBaseUrl(), roomId, doc, {
    WebSocketPolyfill: WebSocket as unknown as typeof globalThis.WebSocket,
    connect: true,
    params: options?.params,
  });

  await waitForProviderSync(provider, 15_000);

  return {
    doc,
    provider,
    destroy: () => {
      provider.destroy();
      doc.destroy();
    },
  };
}

export function waitForProviderSync(provider: WebsocketProvider, timeoutMs: number): Promise<void> {
  if (provider.synced) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Timed out waiting for y-websocket sync'));
    }, timeoutMs);

    const onSync = (synced: boolean) => {
      if (!synced) return;
      cleanup();
      resolve();
    };

    const cleanup = () => {
      clearTimeout(timer);
      provider.off('sync', onSync);
    };

    provider.on('sync', onSync);
  });
}

/** Raw upgrade probe (invalid rooms, close codes). */
export function openRawSocket(pathWithQuery: string): WebSocket {
  const base = e2eWsBaseUrl().replace(/\/ws$/, '');
  return new WebSocket(`${base}${pathWithQuery}`);
}

export function waitForClose(socket: WebSocket, timeoutMs: number): Promise<{ code: number; reason: string }> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.terminate();
      reject(new Error('Timed out waiting for WebSocket close'));
    }, timeoutMs);

    socket.once('close', (code, reasonBuf) => {
      clearTimeout(timer);
      resolve({ code, reason: reasonBuf.toString('utf8') });
    });

    socket.once('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
