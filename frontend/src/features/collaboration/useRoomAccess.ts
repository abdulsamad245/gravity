import { useEffect, useState } from 'react';
import { deriveCanEdit, type LinkAccess, type RoomAccessState } from '../../shared/types/room-access';
import type { RoomConnection } from './RoomConnection';

export interface RoomAccessApi extends RoomAccessState {
  canEdit: boolean;
  isOwner: boolean;
  hasPendingRequest: boolean;
  setLinkAccess: (mode: LinkAccess) => void;
  requestEditAccess: () => void;
  approveEditRequest: (userId: string) => void;
  denyEditRequest: (userId: string) => void;
  revokeEditor: (userId: string) => void;
}

/** Live Docs-style room ACL from Y.Doc meta. */
export function useRoomAccess(conn: RoomConnection): RoomAccessApi {
  const [access, setAccess] = useState(() => conn.getRoomAccess());

  useEffect(() => {
    const sync = () => setAccess(conn.getRoomAccess());
    const seed = () => {
      conn.seedRoomAccessIfNeeded();
      sync();
    };
    sync();
    conn.persistence.once('synced', seed);
    const t = window.setTimeout(seed, 0);
    conn.meta.observe(sync);
    return () => {
      window.clearTimeout(t);
      conn.meta.unobserve(sync);
      conn.persistence.off('synced', seed);
    };
  }, [conn]);

  const canEdit = deriveCanEdit(access, conn.identity.id);
  const isOwner = !!access.ownerId && access.ownerId === conn.identity.id;
  const hasPendingRequest = access.pendingEditRequests.some((r) => r.id === conn.identity.id);

  return {
    ...access,
    canEdit,
    isOwner,
    hasPendingRequest,
    setLinkAccess: (mode) => conn.setLinkAccess(mode),
    requestEditAccess: () => conn.requestEditAccess(),
    approveEditRequest: (id) => conn.approveEditRequest(id),
    denyEditRequest: (id) => conn.denyEditRequest(id),
    revokeEditor: (id) => conn.revokeEditor(id),
  };
}
