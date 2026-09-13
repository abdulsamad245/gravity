import { useEffect, useState } from 'react';
import { REACTION_TTL_MS } from '../../shared/constants/facilitation.constants';
import type { AwarenessState, PresenceReaction } from '../../shared/types';
import { useViewStore } from '../../stores/view.store';
import type { RoomConnection } from '../collaboration/RoomConnection';

interface Bubble {
  key: string;
  glyph: string;
  name: string;
  color: string;
  x: number;
  y: number;
  at: number;
  hand: boolean;
}

function readBubbles(conn: RoomConnection, now: number): Bubble[] {
  const out: Bubble[] = [];
  conn.awareness.getStates().forEach((raw, clientId) => {
    const s = raw as AwarenessState;
    if (!s?.user) return;
    const reaction = s.reaction as PresenceReaction | null | undefined;
    if (reaction && now - reaction.at < REACTION_TTL_MS) {
      out.push({
        key: `r-${clientId}-${reaction.at}`,
        glyph: reaction.glyph,
        name: s.user.name,
        color: s.user.color,
        x: reaction.x,
        y: reaction.y,
        at: reaction.at,
        hand: false,
      });
    }
    if (s.handRaised) {
      const cx = s.cursor?.x ?? (s.viewport ? s.viewport.x + s.viewport.w / 2 : reaction?.x);
      const cy = s.cursor?.y ?? (s.viewport ? s.viewport.y + s.viewport.h / 2 : reaction?.y);
      if (typeof cx === 'number' && typeof cy === 'number') {
        out.push({
          key: `h-${clientId}`,
          glyph: '✋',
          name: s.user.name,
          color: s.user.color,
          x: cx,
          y: cy - 36,
          at: now,
          hand: true,
        });
      }
    }
  });
  return out;
}

/** Includes local user - awareness mirrors to every client. */
export function ReactionsOverlay({ conn }: { conn: RoomConnection }) {
  const view = useViewStore();
  const [now, setNow] = useState(Date.now());
  const [bubbles, setBubbles] = useState<Bubble[]>([]);

  useEffect(() => {
    const tick = () => {
      const t = Date.now();
      setNow(t);
      setBubbles(readBubbles(conn, t));
    };
    tick();
    const id = window.setInterval(tick, 100);
    conn.awareness.on('change', tick);
    return () => {
      window.clearInterval(id);
      conn.awareness.off('change', tick);
    };
  }, [conn]);

  // Publisher TTL cleanup for our own reaction.
  useEffect(() => {
    const id = window.setInterval(() => {
      const local = conn.awareness.getLocalState() as AwarenessState | null;
      const r = local?.reaction;
      if (r && Date.now() - r.at >= REACTION_TTL_MS) {
        conn.setPresence({ reaction: null });
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [conn]);

  if (bubbles.length === 0) return null;

  return (
    <div className="reactions-overlay" aria-live="polite" aria-atomic="false">
      {bubbles.map((b) => {
        const left = b.x * view.scale + view.x;
        const top = b.y * view.scale + view.y;
        const age = now - b.at;
        const life = b.hand ? 1 : Math.max(0, 1 - age / REACTION_TTL_MS);
        return (
          <div
            key={b.key}
            className={`reaction-bubble ${b.hand ? 'reaction-hand' : ''}`}
            style={{
              left,
              top,
              opacity: b.hand ? 1 : 0.35 + life * 0.65,
              ['--reaction-float' as string]: b.hand ? '0px' : `${(1 - life) * -12}px`,
            }}
          >
            <span className="reaction-avatar" style={{ background: b.color }} aria-hidden>
              {b.name.trim().slice(0, 1).toUpperCase() || '?'}
            </span>
            <span className="reaction-glyph" aria-hidden>
              {b.glyph}
            </span>
            <span className="sr-only">
              {b.hand ? `${b.name} raised their hand` : `${b.name} reacted ${b.glyph}`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
