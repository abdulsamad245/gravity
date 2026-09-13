import type Konva from 'konva';
import { useMemo, type RefObject } from 'react';
import { Layer, Stage } from 'react-konva';
import type { CanvasObject } from '../../shared/types';
import { canvasThemeColors, useThemeStore } from '../../stores/theme.store';
import { useUiStore } from '../../stores/ui.store';
import type { ReplayExportSize, ReplayExportView } from '../../stores/replay-export.store';
import { GridLayer } from '../canvas/GridLayer';
import { isMindMapBranchHidden } from '../canvas/mind-map';
import { ConnectorLayer } from '../canvas/objects/ConnectorLayer';
import { MindMapLayer } from '../canvas/objects/MindMapLayer';
import { ObjectNode } from '../canvas/objects/ObjectNode';

const noop = () => undefined;

interface Props {
  stageRef: RefObject<Konva.Stage | null>;
  objects: Record<string, CanvasObject>;
  view: ReplayExportView;
  size: ReplayExportSize;
}

/**
 * Read-only Konva stage used only for WebM frame capture. Kept off-screen so
 * the live board (and Yjs sync) stay interactive while export runs.
 */
export function ReplayExportStage({ stageRef, objects, view, size }: Props) {
  const theme = useThemeStore((s) => s.resolved);
  const canvasBg = useUiStore((s) => s.canvasBg);
  const { bg } = canvasThemeColors(theme, canvasBg);

  const sorted = useMemo(
    () => Object.values(objects).sort((a, b) => (a.z ?? 0) - (b.z ?? 0)),
    [objects],
  );

  return (
    <Stage
      ref={stageRef as React.Ref<Konva.Stage>}
      width={Math.max(1, size.w)}
      height={Math.max(1, size.h)}
      x={view.x}
      y={view.y}
      scaleX={view.scale}
      scaleY={view.scale}
      listening={false}
      style={{ background: bg }}
    >
      <GridLayer width={size.w} height={size.h} />
      <Layer name="objects" listening={false}>
        <ConnectorLayer objects={objects} interactive={false} onSelect={noop} />
        <MindMapLayer objects={objects} />
        {sorted
          .filter(
            (o) =>
              o.type !== 'connector' &&
              o.type !== 'rope' &&
              !isMindMapBranchHidden(o, objects),
          )
          .map((obj) => (
            <ObjectNode
              key={obj.id}
              obj={obj}
              interactive={false}
              selected={false}
              onSelect={noop}
              onCommit={noop}
              onImpulse={noop}
              onEditText={noop}
            />
          ))}
      </Layer>
      {/* Named so record-replay-video can hide selection chrome if present. */}
      <Layer name="overlay" listening={false} visible={false} />
    </Stage>
  );
}
