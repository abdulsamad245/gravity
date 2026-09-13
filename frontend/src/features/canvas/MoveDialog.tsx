import { useEffect, useState } from 'react';
import { CloseButton } from '../../shared/components/CloseButton';
import type { CanvasObject } from '../../shared/types';

interface Props {
  obj: CanvasObject;
  onMove: (x: number, y: number) => void;
  onClose: () => void;
}

/** Non-drag move dialog for keyboard / a11y users. */
export function MoveDialog({ obj, onMove, onClose }: Props) {
  const [x, setX] = useState(String(Math.round(obj.x)));
  const [y, setY] = useState(String(Math.round(obj.y)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="move-dialog panel" role="dialog" aria-label="Move object by coordinates">
      <div className="move-dialog-head">
        <span className="move-dialog-title">Move</span>
        <CloseButton onClick={onClose} size={16} />
      </div>
      <label>
        X
        <input className="input" value={x} onChange={(e) => setX(e.target.value)} inputMode="numeric" />
      </label>
      <label>
        Y
        <input className="input" value={y} onChange={(e) => setY(e.target.value)} inputMode="numeric" />
      </label>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => {
          const nx = Number(x);
          const ny = Number(y);
          if (!Number.isFinite(nx) || !Number.isFinite(ny)) return;
          onMove(nx, ny);
          onClose();
        }}
      >
        Move
      </button>
    </div>
  );
}
