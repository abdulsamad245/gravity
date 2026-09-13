import { useEffect, useRef, useState } from 'react';
import type { AwarenessState } from '../../shared/types';
import type { RoomConnection } from './RoomConnection';
import type { ConnectionStatus } from './RoomConnection';

export interface RemoteUser {
  clientId: number;
  state: AwarenessState;
}

/** All *other* users' presence states, refreshed on every awareness change. */
export function useRemoteUsers(conn: RoomConnection): RemoteUser[] {
  const [users, setUsers] = useState<RemoteUser[]>([]);

  useEffect(() => {
    const update = () => {
      const list: RemoteUser[] = [];
      conn.awareness.getStates().forEach((state, clientId) => {
        if (clientId === conn.awareness.clientID) return;
        if (state && (state as AwarenessState).user) {
          list.push({ clientId, state: state as AwarenessState });
        }
      });
      setUsers(list);
    };
    update();
    conn.awareness.on('change', update);
    return () => conn.awareness.off('change', update);
  }, [conn]);

  return users;
}

/**
 * Live connection status driving the badge. y-websocket auto-retries after
 * a drop (status flips to "connecting"), so the browser's own online flag
 * decides between "reconnecting" and "you are offline".
 */
export function useConnectionStatus(conn: RoomConnection): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const hasConnected = useRef(conn.provider.wsconnected);

  useEffect(() => {
    const update = () => {
      if (conn.provider.wsconnected) {
        hasConnected.current = true;
        setStatus('online');
        return;
      }
      setStatus(navigator.onLine ? (hasConnected.current ? 'reconnecting' : 'connecting') : 'offline');
    };
    conn.provider.on('status', update);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
    return () => {
      conn.provider.off('status', update);
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, [conn]);

  return status;
}

/**
 * The physics host is the connected *editor* with the lowest awareness id —
 * a deterministic election with no extra coordination. Viewers are excluded
 * so they never publish physics ticks. Offline you are host if you can edit.
 */
export function useIsPhysicsHost(conn: RoomConnection): boolean {
  const [isHost, setIsHost] = useState(true);

  useEffect(() => {
    const update = () => {
      if (!conn.canEdit()) {
        setIsHost(false);
        return;
      }
      const editorClientIds: number[] = [];
      conn.awareness.getStates().forEach((state, clientId) => {
        const userId = (state as { user?: { id?: string } } | null)?.user?.id;
        if (userId && conn.canEdit(userId)) editorClientIds.push(clientId);
      });
      // Include self if somehow missing from map briefly.
      if (!editorClientIds.includes(conn.awareness.clientID)) {
        editorClientIds.push(conn.awareness.clientID);
      }
      setIsHost(editorClientIds.length === 0 || Math.min(...editorClientIds) === conn.awareness.clientID);
    };
    update();
    conn.awareness.on('change', update);
    conn.meta.observe(update);
    return () => {
      conn.awareness.off('change', update);
      conn.meta.unobserve(update);
    };
  }, [conn]);

  return isHost;
}
