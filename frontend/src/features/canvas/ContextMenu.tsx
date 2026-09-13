import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CanvasObject } from '../../shared/types';
import type { ToolId } from '../../shared/constants/object-types';

export interface ContextMenuState {
  x: number;
  y: number;
  world: { x: number; y: number };
  targetId: string | null;
}

interface Props {
  menu: ContextMenuState;
  selected: CanvasObject | undefined;
  onClose: () => void;
  onAction: (action: ContextAction) => void;
  canPaste: boolean;
  canSelectAll: boolean;
  /** Author or room owner may delete/cut. */
  canDeleteSelected?: boolean;
}

export type ContextAction =
  | { type: 'paste' }
  | { type: 'insert'; tool: ToolId }
  | { type: 'selectAll' }
  | { type: 'zoomFit' }
  | { type: 'zoom100' }
  | { type: 'duplicate' }
  | { type: 'copy' }
  | { type: 'cut' }
  | { type: 'delete' }
  | { type: 'bringFront' }
  | { type: 'sendBack' }
  | { type: 'togglePhysics' }
  | { type: 'toggleLock' }
  | { type: 'copyLink' }
  | { type: 'clearContent' }
  | { type: 'moveDialog' }
  | { type: 'comment' }
  | { type: 'presentFrom' };

const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform) ? '⌘' : 'Ctrl';

export function ContextMenu({
  menu,
  selected,
  onClose,
  onAction,
  canPaste,
  canSelectAll,
  canDeleteSelected = true,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: menu.x, top: menu.y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    let left = menu.x;
    let top = menu.y;
    if (left + rect.width > window.innerWidth - pad) left = window.innerWidth - rect.width - pad;
    if (top + rect.height > window.innerHeight - pad) top = window.innerHeight - rect.height - pad;
    if (left < pad) left = pad;
    if (top < pad) top = pad;
    setPos({ left, top });
  }, [menu.x, menu.y, selected, canPaste, canSelectAll]);

  useEffect(() => {
    const first = ref.current?.querySelector<HTMLElement>('button:not(:disabled)');
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  const run = (action: ContextAction) => {
    onAction(action);
    onClose();
  };

  const locked = !!selected?.locked;
  const hasTextContent =
    !!selected &&
    (selected.type === 'sticky' || selected.type === 'text' || selected.type === 'frame' || selected.type === 'code') &&
    !!(selected.text && selected.text.trim());

  return (
    <div
      ref={ref}
      className="context-menu panel"
      role="menu"
      aria-label={selected ? 'Object menu' : 'Canvas menu'}
      style={{ left: pos.left, top: pos.top }}
    >
      {selected ? (
        <>
          <MenuItem label="Copy" shortcut={`${MOD}+C`} onClick={() => run({ type: 'copy' })} />
          <MenuItem
            label="Cut"
            shortcut={`${MOD}+X`}
            disabled={locked || !canDeleteSelected}
            onClick={() => run({ type: 'cut' })}
          />
          <MenuItem label="Paste" shortcut={`${MOD}+V`} disabled={!canPaste} onClick={() => run({ type: 'paste' })} />
          <MenuItem label="Duplicate" shortcut={`${MOD}+D`} onClick={() => run({ type: 'duplicate' })} />
          <div className="context-sep" />
          <MenuItem label="Bring to front" shortcut={`${MOD}+]`} disabled={locked} onClick={() => run({ type: 'bringFront' })} />
          <MenuItem label="Send to back" shortcut={`${MOD}+[`} disabled={locked} onClick={() => run({ type: 'sendBack' })} />
          <MenuItem
            label={selected.physics ? 'Physics off' : 'Physics on'}
            onClick={() => run({ type: 'togglePhysics' })}
          />
          <MenuItem label={locked ? 'Unlock' : 'Lock'} onClick={() => run({ type: 'toggleLock' })} />
          {(selected.type === 'sticky' || selected.type === 'text' || selected.type === 'frame' || selected.type === 'code') && (
            <MenuItem
              label="Clear content"
              disabled={!hasTextContent || locked}
              onClick={() => run({ type: 'clearContent' })}
            />
          )}
          <MenuItem label="Add comment" onClick={() => run({ type: 'comment' })} />
          <MenuItem label="Copy link to object" onClick={() => run({ type: 'copyLink' })} />
          <MenuItem label="Move…" onClick={() => run({ type: 'moveDialog' })} />
          {selected.type === 'frame' && (
            <MenuItem label="Present from here" onClick={() => run({ type: 'presentFrom' })} />
          )}
          <div className="context-sep" />
          <MenuItem
            label={canDeleteSelected ? 'Delete' : 'You cannot delete this'}
            danger
            disabled={locked || !canDeleteSelected}
            onClick={() => run({ type: 'delete' })}
          />
        </>
      ) : (
        <>
          <MenuItem label="Paste" shortcut={`${MOD}+V`} disabled={!canPaste} onClick={() => run({ type: 'paste' })} />
          <div className="context-sep" />
          <MenuItem label="Add sticky note" onClick={() => run({ type: 'insert', tool: 'sticky' })} />
          <MenuItem label="Add text" onClick={() => run({ type: 'insert', tool: 'text' })} />
          <MenuItem label="Add code block" onClick={() => run({ type: 'insert', tool: 'code' })} />
          <MenuItem label="Add comment" onClick={() => run({ type: 'comment' })} />
          <MenuItem label="Add frame" onClick={() => run({ type: 'insert', tool: 'frame' })} />
          <MenuItem label="Add rectangle" onClick={() => run({ type: 'insert', tool: 'rect' })} />
          <MenuItem label="Add ellipse" onClick={() => run({ type: 'insert', tool: 'ellipse' })} />
          <div className="context-sep" />
          <MenuItem
            label="Select all"
            shortcut={`${MOD}+A`}
            disabled={!canSelectAll}
            onClick={() => run({ type: 'selectAll' })}
          />
          <MenuItem label="Zoom to fit" onClick={() => run({ type: 'zoomFit' })} />
          <MenuItem label="Zoom 100%" onClick={() => run({ type: 'zoom100' })} />
        </>
      )}
    </div>
  );
}

function MenuItem({
  label,
  shortcut,
  onClick,
  danger,
  disabled,
}: {
  label: string;
  shortcut?: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`context-item ${danger ? 'danger' : ''}`}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      onClick={() => {
        if (!disabled) onClick();
      }}
    >
      <span className="context-item-label">{label}</span>
      {shortcut ? <span className="context-item-shortcut">{shortcut}</span> : null}
    </button>
  );
}
