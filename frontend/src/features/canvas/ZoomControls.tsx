import { Minus, Plus, Redo2, Undo2 } from 'lucide-react';
import { Tooltip } from '../../shared/components/Tooltip';
import { ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from '../../shared/constants/canvas.constants';
import type { CanvasObject } from '../../shared/types';
import { clamp, worldBounds } from '../../shared/utils/geometry';
import { useViewStore } from '../../stores/view.store';
import type { RoomConnection } from '../collaboration/RoomConnection';

interface Props {
  objects: Record<string, CanvasObject>;
  conn: RoomConnection;
}

export function ZoomControls({ objects, conn }: Props) {
  const { scale, setView, x, y } = useViewStore();
  const pct = Math.round(scale * 100);

  const zoomBy = (factor: number) => {
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const newScale = clamp(scale * factor, ZOOM_MIN, ZOOM_MAX);
    const worldX = (cx - x) / scale;
    const worldY = (cy - y) / scale;
    setView({ scale: newScale, x: cx - worldX * newScale, y: cy - worldY * newScale });
  };

  const zoomFit = () => {
    const b = worldBounds(Object.values(objects));
    if (!b) {
      setView({ x: 0, y: 0, scale: 1 });
      return;
    }
    const pad = 80;
    const w = b.maxX - b.minX + pad * 2;
    const h = b.maxY - b.minY + pad * 2;
    const s = clamp(Math.min(window.innerWidth / w, window.innerHeight / h), ZOOM_MIN, 1.5);
    setView({
      scale: s,
      x: -b.minX * s + (window.innerWidth - (b.maxX - b.minX) * s) / 2,
      y: -b.minY * s + (window.innerHeight - (b.maxY - b.minY) * s) / 2,
    });
  };

  return (
    <div className="canvas-chrome" role="group" aria-label="Zoom and history" data-tour="zoom">
      <div className="zoom-pill panel">
        <Tooltip label="Zoom out" side="right">
          <button type="button" className="chrome-btn" aria-label="Zoom out" onClick={() => zoomBy(1 / ZOOM_STEP)}>
            <Minus size={16} strokeWidth={2} />
          </button>
        </Tooltip>
        <Tooltip label="Reset to 100%" side="right">
          <button
            type="button"
            className="chrome-btn zoom-pct"
            aria-label={`Zoom ${pct} percent. Click for 100%.`}
            onClick={() => setView({ scale: 1, x: 0, y: 0 })}
          >
            {pct}%
          </button>
        </Tooltip>
        <Tooltip label="Zoom in" side="right">
          <button type="button" className="chrome-btn" aria-label="Zoom in" onClick={() => zoomBy(ZOOM_STEP)}>
            <Plus size={16} strokeWidth={2} />
          </button>
        </Tooltip>
        <span className="chrome-sep" aria-hidden />
        <Tooltip label="Zoom to fit" side="right">
          <button type="button" className="chrome-btn zoom-fit" aria-label="Zoom to fit" onClick={zoomFit}>
            Fit
          </button>
        </Tooltip>
      </div>

      <div className="history-pill panel">
        <Tooltip label="Undo (Ctrl+Z)" side="top">
          <button
            type="button"
            className="chrome-btn"
            aria-label="Undo"
            onClick={() => conn.undoManager.undo()}
          >
            <Undo2 size={16} strokeWidth={2} />
          </button>
        </Tooltip>
        <Tooltip label="Redo (Ctrl+Y)" side="top">
          <button
            type="button"
            className="chrome-btn"
            aria-label="Redo"
            onClick={() => conn.undoManager.redo()}
          >
            <Redo2 size={16} strokeWidth={2} />
          </button>
        </Tooltip>
      </div>

    </div>
  );
}
