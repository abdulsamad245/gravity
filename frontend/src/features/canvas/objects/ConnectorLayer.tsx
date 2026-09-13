import { memo } from 'react';
import { Arrow, Group, Line } from 'react-konva';
import { DEFAULT_CONNECTOR_STYLE, isConnectorStyle } from '../../../shared/constants/connector.constants';
import type { CanvasObject } from '../../../shared/types';
import { connectorPoints } from '../../../shared/utils/connector-geometry';

interface Props {
  objects: Record<string, CanvasObject>;
  interactive: boolean;
  onSelect: (id: string, additive?: boolean) => void;
}

export const ConnectorLayer = memo(function ConnectorLayer({ objects, interactive, onSelect }: Props) {
  const links = Object.values(objects).filter((o) => o.type === 'connector' || o.type === 'rope');

  return (
    <Group listening={interactive}>
      {links.map((c) => {
        const from = c.fromId ? objects[c.fromId] : undefined;
        const to = c.toId ? objects[c.toId] : undefined;
        if (!from || !to) return null;
        const x1 = from.x + from.width / 2;
        const y1 = from.y + from.height / 2;
        const x2 = to.x + to.width / 2;
        const y2 = to.y + to.height / 2;
        const color = c.stroke ?? c.fill ?? '#8b949e';
        const style = isConnectorStyle(c.connectorStyle) ? c.connectorStyle : DEFAULT_CONNECTOR_STYLE;
        const points =
          c.type === 'rope'
            ? [x1, y1, x2, y2]
            : connectorPoints(x1, y1, x2, y2, style);
        const pick = (e: { cancelBubble: boolean; evt: MouseEvent | TouchEvent }) => {
          e.cancelBubble = true;
          const ev = e.evt as MouseEvent;
          const additive = !!(ev.shiftKey || ev.ctrlKey || ev.metaKey);
          onSelect(c.id, additive);
        };
        if (c.type === 'rope') {
          return (
            <Line
              key={c.id}
              id={`obj-${c.id}`}
              points={points}
              stroke={color}
              strokeWidth={c.strokeWidth ?? 4}
              dash={[10, 8]}
              lineCap="round"
              hitStrokeWidth={18}
              onClick={pick}
              onTap={pick}
            />
          );
        }
        return (
          <Arrow
            key={c.id}
            id={`obj-${c.id}`}
            points={points}
            stroke={color}
            fill={color}
            strokeWidth={c.strokeWidth ?? 3}
            pointerLength={12}
            pointerWidth={10}
            lineCap="round"
            lineJoin="round"
            hitStrokeWidth={16}
            onClick={pick}
            onTap={pick}
          />
        );
      })}
    </Group>
  );
});
