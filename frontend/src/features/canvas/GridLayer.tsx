import { memo } from 'react';
import { Layer, Shape } from 'react-konva';
import { GRID_BASE_SPACING } from '../../shared/constants/canvas.constants';
import { canvasThemeColors, useThemeStore } from '../../stores/theme.store';
import { useUiStore } from '../../stores/ui.store';
import { useViewStore } from '../../stores/view.store';

/**
 * Infinite dot grid. Only the currently visible world region is drawn,
 * and spacing adapts to zoom so dot density stays constant on screen.
 */
export const GridLayer = memo(function GridLayer({ width, height }: { width: number; height: number }) {
  const { x, y, scale } = useViewStore();
  const theme = useThemeStore((s) => s.resolved);
  const canvasBg = useUiStore((s) => s.canvasBg);
  const { grid } = canvasThemeColors(theme, canvasBg);

  let spacing = GRID_BASE_SPACING;
  while (spacing * scale < 40) spacing *= 2;
  while (spacing * scale > 120) spacing /= 2;

  const worldLeft = -x / scale;
  const worldTop = -y / scale;
  const worldRight = worldLeft + width / scale;
  const worldBottom = worldTop + height / scale;

  const startX = Math.floor(worldLeft / spacing) * spacing;
  const startY = Math.floor(worldTop / spacing) * spacing;
  const dotRadius = 1.4 / scale;

  return (
    <Layer listening={false} name="grid">
      <Shape
        sceneFunc={(context) => {
          const ctx = (context as unknown as { _context: CanvasRenderingContext2D })._context;
          ctx.beginPath();
          for (let gx = startX; gx <= worldRight; gx += spacing) {
            for (let gy = startY; gy <= worldBottom; gy += spacing) {
              ctx.moveTo(gx + dotRadius, gy);
              ctx.arc(gx, gy, dotRadius, 0, Math.PI * 2);
            }
          }
          ctx.fillStyle = grid;
          ctx.fill();
        }}
      />
    </Layer>
  );
});
