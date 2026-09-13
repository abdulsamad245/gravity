/**
 * Minimal type declarations for y-websocket's server utilities,
 * which ship as untyped JavaScript.
 */
declare module 'y-websocket/bin/utils' {
  import type { IncomingMessage } from 'http';
  import type WebSocket from 'ws';
  import type * as Y from 'yjs';

  /** A Y.Doc extended with the live WebSocket connections of the room. */
  export interface WSSharedDoc extends Y.Doc {
    name: string;
    conns: Map<unknown, Set<number>>;
  }

  export function setupWSConnection(
    conn: WebSocket,
    req: IncomingMessage,
    opts?: { docName?: string; gc?: boolean },
  ): void;

  export interface Persistence {
    provider?: unknown;
    bindState(docName: string, doc: WSSharedDoc): void | Promise<void>;
    writeState(docName: string, doc: WSSharedDoc): Promise<unknown>;
  }

  export function setPersistence(persistence: Persistence | null): void;

  /** Registry of all live room documents, keyed by room name. */
  export const docs: Map<string, WSSharedDoc>;
}
