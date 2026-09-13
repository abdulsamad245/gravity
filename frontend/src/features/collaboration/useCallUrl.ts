import { useEffect, useState } from 'react';
import { validateCallUrl } from '../../shared/utils/validate-call-url';
import type { RoomConnection } from './RoomConnection';

export { validateCallUrl } from '../../shared/utils/validate-call-url';

/** Shared external call link from Y.Doc meta (Meet / Zoom / Discord, etc.). */
export function useCallUrl(conn: RoomConnection): {
  callUrl: string;
  setCallUrl: (url: string) => void;
  hasCall: boolean;
} {
  const [callUrl, setCallUrlState] = useState(() => conn.getCallUrl());

  useEffect(() => {
    const sync = () => setCallUrlState(conn.getCallUrl());
    sync();
    conn.meta.observe(sync);
    return () => conn.meta.unobserve(sync);
  }, [conn]);

  const checked = validateCallUrl(callUrl);
  const safeUrl = checked.ok ? checked.href : '';

  return {
    callUrl: safeUrl,
    hasCall: !!safeUrl,
    setCallUrl: (url: string) => {
      const next = validateCallUrl(url);
      if (!next.ok) return;
      conn.setCallUrl(next.href);
      setCallUrlState(conn.getCallUrl());
    },
  };
}

/** Always opens in a new tab; no-ops when the link is missing or invalid. */
export function openCallUrl(href: string): boolean {
  const checked = validateCallUrl(href);
  if (!checked.ok || !checked.href) return false;
  const win = window.open(checked.href, '_blank', 'noopener,noreferrer');
  if (win) win.opener = null;
  return true;
}
