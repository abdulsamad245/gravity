import { memo, useEffect, useRef } from 'react';
import type { CanvasObject } from '../../shared/types';
import { worldBounds } from '../../shared/utils/geometry';
import { useViewStore } from '../../stores/view.store';
import type { RemoteUser } from '../collaboration/useAwareness';

const MAP_W = 220;
const MAP_H = 150;
const PAD = 12;

interface Props {
  objects: Record<string, CanvasObject>;
  remoteUsers: RemoteUser[];
}

/**
 * Minimap + radar: object footprints, your viewport (white), and every
 * other user's live viewport and cursor in their color. Clicking jumps
 * the camera to that world position.
 */
export const Minimap = memo(function Minimap({ objects, remoteUsers }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Latest props in refs so the draw loop never re-subscribes.
  const stateRef = useRef({ objects, remoteUsers });
  stateRef.current = { objects, remoteUsers };
  const mappingRef = useRef({ scale: 1, offX: 0, offY: 0 });

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const { objects, remoteUsers } = stateRef.current;
      const view = useViewStore.getState();
      const list = Object.values(objects);

      // World rect to display: content ∪ own viewport ∪ remote viewports.
      const vpWorld = {
        minX: -view.x / view.scale,
        minY: -view.y / view.scale,
        maxX: (-view.x + window.innerWidth) / view.scale,
        maxY: (-view.y + window.innerHeight) / view.scale,
      };
      const b = worldBounds(list) ?? vpWorld;
      let minX = Math.min(b.minX, vpWorld.minX);
      let minY = Math.min(b.minY, vpWorld.minY);
      let maxX = Math.max(b.maxX, vpWorld.maxX);
      let maxY = Math.max(b.maxY, vpWorld.maxY);
      for (const u of remoteUsers) {
        const vp = u.state.viewport;
        if (!vp) continue;
        minX = Math.min(minX, vp.x);
        minY = Math.min(minY, vp.y);
        maxX = Math.max(maxX, vp.x + vp.w);
        maxY = Math.max(maxY, vp.y + vp.h);
      }

      const scale = Math.min((MAP_W - PAD * 2) / Math.max(1, maxX - minX), (MAP_H - PAD * 2) / Math.max(1, maxY - minY));
      const offX = PAD - minX * scale;
      const offY = PAD - minY * scale;
      mappingRef.current = { scale, offX, offY };
      const tx = (x: number) => x * scale + offX;
      const ty = (y: number) => y * scale + offY;

      ctx.clearRect(0, 0, MAP_W, MAP_H);

      // Objects
      for (const o of list) {
        ctx.fillStyle = o.type === 'path' ? (o.stroke ?? o.fill) : o.fill === 'transparent' ? '#888' : o.fill;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(tx(o.x), ty(o.y), Math.max(2, o.width * scale), Math.max(2, o.height * scale));
      }
      ctx.globalAlpha = 1;

      // Remote users: viewport rectangles + cursor dots in their color.
      for (const u of remoteUsers) {
        const color = u.state.user.color;
        const vp = u.state.viewport;
        if (vp) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.5;
          ctx.strokeRect(tx(vp.x), ty(vp.y), vp.w * scale, vp.h * scale);
        }
        const cur = u.state.cursor;
        if (cur) {
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(tx(cur.x), ty(cur.y), 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Own viewport (white).
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(tx(vpWorld.minX), ty(vpWorld.minY), (vpWorld.maxX - vpWorld.minX) * scale, (vpWorld.maxY - vpWorld.minY) * scale);
    };

    const timer = window.setInterval(draw, 100);
    draw();
    return () => clearInterval(timer);
  }, []);

  const jump = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const { scale, offX, offY } = mappingRef.current;
    // Map CSS box → backing-store pixels (compact mobile sizes use CSS width/height).
    const sx = MAP_W / Math.max(1, rect.width);
    const sy = MAP_H / Math.max(1, rect.height);
    const wx = ((e.clientX - rect.left) * sx - offX) / scale;
    const wy = ((e.clientY - rect.top) * sy - offY) / scale;
    const view = useViewStore.getState();
    view.setView({
      x: window.innerWidth / 2 - wx * view.scale,
      y: window.innerHeight / 2 - wy * view.scale,
    });
  };

  return (
    <div className="minimap panel" data-tour="minimap" title="Minimap: click to jump">
      <canvas ref={canvasRef} width={MAP_W} height={MAP_H} onClick={jump} />
    </div>
  );
});
