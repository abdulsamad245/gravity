import { Arrow } from 'react-konva';
import type { CanvasObject } from '../../../shared/types';
import { isMindMapBranchHidden } from '../mind-map';

export function MindMapLayer({ objects }: { objects: Record<string, CanvasObject> }) {
  return (
    <>
      {Object.values(objects).map((child) => {
        if (!child.mindMapId || !child.mindMapParentId) return null;
        const parent = objects[child.mindMapParentId];
        if (!parent || isMindMapBranchHidden(child, objects)) return null;
        return (
          <Arrow
            key={`mind-edge-${child.id}`}
            points={[
              parent.x + parent.width,
              parent.y + parent.height / 2,
              child.x,
              child.y + child.height / 2,
            ]}
            stroke={child.stroke ?? '#74c0fc'}
            fill={child.stroke ?? '#74c0fc'}
            strokeWidth={2}
            pointerLength={7}
            pointerWidth={7}
            listening={false}
          />
        );
      })}
    </>
  );
}
