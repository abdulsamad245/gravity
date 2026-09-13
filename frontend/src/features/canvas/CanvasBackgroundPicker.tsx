import { Pipette } from 'lucide-react';
import { useRef } from 'react';
import { CANVAS_BG_PRESETS, GRAVITY } from '../../shared/constants/colors.constants';
import { canvasThemeColors, useThemeStore } from '../../stores/theme.store';
import { useUiStore } from '../../stores/ui.store';

export function CanvasBackgroundPicker({ onPicked }: { onPicked?: () => void }) {
  const theme = useThemeStore((s) => s.resolved);
  const canvasBg = useUiStore((s) => s.canvasBg);
  const setCanvasBg = useUiStore((s) => s.setCanvasBg);
  const colorRef = useRef<HTMLInputElement>(null);
  const { bg: activeBg } = canvasThemeColors(theme, canvasBg);

  return (
    <div className="canvas-bg-picker">
      <span className="more-label">Background</span>
      <div className="canvas-bg-dots" role="group" aria-label="Canvas background">
        {CANVAS_BG_PRESETS.map((p) => {
          const swatch = p.value ?? canvasThemeColors(theme, null).bg;
          const selected =
            p.value === null ? canvasBg === null : canvasBg?.toLowerCase() === p.value.toLowerCase();
          return (
            <button
              key={p.id}
              type="button"
              className={`canvas-bg-dot ${selected ? 'active' : ''}`}
              style={{ background: swatch }}
              title={p.label}
              aria-label={p.label}
              aria-pressed={selected}
              onClick={() => {
                setCanvasBg(p.value);
                onPicked?.();
              }}
            />
          );
        })}
        <button
          type="button"
          className="canvas-bg-dot canvas-bg-custom"
          aria-label="Custom canvas background"
          title="Custom…"
          onClick={() => colorRef.current?.click()}
        >
          <Pipette size={12} />
        </button>
      </div>
      <input
        ref={colorRef}
        type="color"
        className="color-native"
        value={/^#[0-9a-fA-F]{6}$/.test(activeBg) ? activeBg : GRAVITY.ink}
        onChange={(e) => {
          setCanvasBg(e.target.value);
          onPicked?.();
        }}
        aria-label="Custom canvas background"
        tabIndex={-1}
      />
    </div>
  );
}
