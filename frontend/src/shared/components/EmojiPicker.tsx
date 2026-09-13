import { SmilePlus } from 'lucide-react';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { EMOJI_GROUPS } from '../constants/emoji.constants';
import { Tooltip } from './Tooltip';

interface Props {
  onPick: (emoji: string) => void;
  /** Prevent parent blur (text editors that commit on blur). */
  preventBlur?: boolean;
  side?: 'top' | 'bottom';
  label?: string;
}

interface PanelPos {
  top: number;
  left: number;
  placement: 'top' | 'bottom';
}

/** Curated emoji popover — portaled so parent overflow never clips it. */
export function EmojiPicker({ onPick, preventBlur = true, side = 'top', label = 'Add emoji' }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PanelPos | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const placePanel = () => {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const tr = trigger.getBoundingClientRect();
    const pr = panel.getBoundingClientRect();
    const gap = 8;
    const pad = 8;
    let placement: 'top' | 'bottom' = side;
    let top = placement === 'top' ? tr.top - pr.height - gap : tr.bottom + gap;

    if (placement === 'top' && top < pad) {
      placement = 'bottom';
      top = tr.bottom + gap;
    } else if (placement === 'bottom' && top + pr.height > window.innerHeight - pad) {
      placement = 'top';
      top = tr.top - pr.height - gap;
    }

    let left = tr.right - pr.width;
    left = Math.max(pad, Math.min(left, window.innerWidth - pr.width - pad));
    top = Math.max(pad, Math.min(top, window.innerHeight - pr.height - pad));
    setPos({ top, left, placement });
  };

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    placePanel();
    const onScroll = () => placePanel();
    window.addEventListener('resize', placePanel);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', placePanel);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, side]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const panel =
    open &&
    createPortal(
      <div
        ref={panelRef}
        id={panelId}
        className="emoji-panel panel"
        role="listbox"
        aria-label="Emoji"
        style={
          pos
            ? { top: pos.top, left: pos.left, visibility: 'visible' }
            : { top: 0, left: 0, visibility: 'hidden' }
        }
        onMouseDown={(e) => {
          if (preventBlur) e.preventDefault();
        }}
      >
        {EMOJI_GROUPS.map((group) => (
          <div key={group.label} className="emoji-group">
            <div className="emoji-group-label">{group.label}</div>
            <div className="emoji-grid">
              {group.emojis.map((emoji) => (
                <button
                  key={`${group.label}-${emoji}`}
                  type="button"
                  className="emoji-btn"
                  role="option"
                  aria-label={emoji}
                  onClick={() => {
                    onPick(emoji);
                    setOpen(false);
                  }}
                >
                  <span className="emoji-glyph" aria-hidden>
                    {emoji}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>,
      document.body,
    );

  return (
    <div className={`emoji-picker ${side}`} ref={rootRef}>
      <Tooltip label={open ? '' : label} side={side === 'top' ? 'top' : 'bottom'}>
        <button
          ref={triggerRef}
          type="button"
          className={`emoji-trigger ${open ? 'open' : ''}`}
          aria-label={label}
          aria-expanded={open}
          aria-controls={panelId}
          onMouseDown={(e) => {
            if (preventBlur) e.preventDefault();
          }}
          onClick={() => setOpen((v) => !v)}
        >
          <SmilePlus size={16} strokeWidth={2} />
        </button>
      </Tooltip>
      {panel}
    </div>
  );
}
