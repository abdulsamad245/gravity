import { useEffect, useState } from 'react';
import { APP_NAME } from '../../shared/constants/app.constants';
import { DEFAULT_BOARD_NAME, getBoardName, renameBoardLocal, upsertBoard } from '../../shared/utils/boards';
import type { RoomConnection } from './RoomConnection';

/**
 * Live board title from Y.Doc meta, mirrored into the local boards index.
 * Falls back to the local registry, then "Untitled board".
 */
export function useBoardTitle(conn: RoomConnection): {
  title: string;
  setTitle: (name: string) => void;
} {
  const [title, setTitleState] = useState(() => {
    const synced = conn.getBoardTitle().trim();
    if (synced) return synced;
    return getBoardName(conn.roomId) ?? DEFAULT_BOARD_NAME;
  });

  useEffect(() => {
    document.title = `${title} · ${APP_NAME}`;
    return () => {
      document.title = APP_NAME;
    };
  }, [title]);

  useEffect(() => {
    upsertBoard(conn.roomId);

    const sync = () => {
      const synced = conn.getBoardTitle().trim();
      if (synced) {
        setTitleState(synced);
        renameBoardLocal(conn.roomId, synced);
        return;
      }
      const local = getBoardName(conn.roomId) ?? DEFAULT_BOARD_NAME;
      setTitleState(local);
    };

    const seedIfEmpty = () => {
      if (conn.getBoardTitle().trim()) {
        sync();
        return;
      }
      const local = getBoardName(conn.roomId) ?? DEFAULT_BOARD_NAME;
      conn.setBoardTitle(local);
      sync();
    };

    sync();
    // When IndexedDB finishes loading, meta may arrive after first paint.
    const onSynced = () => seedIfEmpty();
    conn.persistence.once('synced', onSynced);
    conn.meta.observe(sync);
    return () => {
      conn.meta.unobserve(sync);
      conn.persistence.off('synced', onSynced);
    };
  }, [conn]);

  const setTitle = (name: string) => {
    const next = name.trim().slice(0, 80) || DEFAULT_BOARD_NAME;
    setTitleState(next);
    conn.setBoardTitle(next);
    renameBoardLocal(conn.roomId, next);
  };

  return { title, setTitle };
}
