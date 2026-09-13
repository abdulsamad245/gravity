import { useEffect, useRef } from 'react';
import { EmojiPicker } from '../../shared/components/EmojiPicker';
import { DEFAULT_FONT_SIZE, STICKY_FONT_SIZE } from '../../shared/constants/canvas.constants';
import { fontStackFor } from '../../shared/constants/fonts.constants';
import type { CanvasObject } from '../../shared/types';
import { effectiveTextColor } from '../../shared/utils/object-style';
import { insertIntoTextarea } from '../../shared/utils/textarea-insert';
import { useViewStore } from '../../stores/view.store';

interface Props {
  obj: CanvasObject;
  onCommit: (text: string) => void;
  onClose: () => void;
}

/**
 * HTML textarea overlaid on the canvas node (Konva text has no caret).
 * Commits on blur or Escape; Enter inserts newlines.
 */
export function TextEditOverlay({ obj, onCommit, onClose }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const view = useViewStore();

  useEffect(() => {
    // Deferred: when the editor opens from a mousedown, the browser's default
    // action (focusing the click target) runs AFTER handlers — focusing
    // immediately would get blurred right back. rAF lands after it.
    const raf = requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.select();
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  const left = obj.x * view.scale + view.x;
  const top = obj.y * view.scale + view.y;
  const width = obj.width * view.scale;
  const height = obj.height * view.scale;
  const fontSize = (obj.fontSize ?? (obj.type === 'sticky' ? STICKY_FONT_SIZE : DEFAULT_FONT_SIZE)) * view.scale;
  const basePad = (obj.type === 'sticky' ? 14 : 8) * view.scale;
  const indentPad = (obj.indent ?? 0) * 12 * view.scale;

  const finish = () => {
    onCommit(ref.current?.value ?? '');
    onClose();
  };

  const initial = obj.type === 'table' ? (obj.cells ?? '') : (obj.text ?? '');

  // No opaque editor chrome — stickies keep their note color; plain text is clear
  // so light/dark canvas shows through. Highlight still tints when set.
  const editorBg =
    obj.highlight || (obj.type === 'sticky' ? obj.fill : 'transparent');

  return (
    <div className="text-edit-shell" style={{ left, top, width, height }}>
      <textarea
        ref={ref}
        className={`text-edit-overlay${obj.type === 'sticky' || obj.highlight ? '' : ' plain'}`}
        defaultValue={initial}
        aria-label={obj.type === 'table' ? 'Edit table cells (CSV)' : 'Edit text'}
        style={{
          fontSize: obj.type === 'table' ? 12 * view.scale : fontSize,
          padding: `${basePad}px ${basePad}px ${basePad}px ${basePad + indentPad}px`,
          color: effectiveTextColor(obj),
          background: editorBg,
          fontFamily: fontStackFor(obj.fontFamily),
          fontWeight: (obj.fontStyle ?? '').includes('bold') ? 700 : 400,
          fontStyle: (obj.fontStyle ?? '').includes('italic') ? 'italic' : 'normal',
          textDecoration: [
            (obj.textDecoration ?? '').includes('underline') ? 'underline' : '',
            (obj.textDecoration ?? '').includes('line-through') ? 'line-through' : '',
          ]
            .filter(Boolean)
            .join(' ') || 'none',
          textAlign: obj.align ?? 'left',
          caretColor: 'var(--text)',
        }}
        onBlur={finish}
        onKeyDown={(e) => {
          if (e.key === 'Escape') finish();
          e.stopPropagation();
        }}
      />
      <div className="text-edit-emoji">
        <EmojiPicker
          side="bottom"
          onPick={(emoji) => {
            const el = ref.current;
            if (!el) return;
            insertIntoTextarea(el, emoji);
            el.focus();
          }}
        />
      </div>
    </div>
  );
}
