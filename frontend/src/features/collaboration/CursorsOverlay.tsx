import { memo, useMemo } from 'react';
import { Circle, Group, Line, Path, Rect, Text } from 'react-konva';
import { useViewStore } from '../../stores/view.store';
import type { RemoteUser } from './useAwareness';

/**
 * Remote cursor size: tip ~14–16px (near system cursor), name chip ~11px type.
 * Tip includes a small mass dot so it stays recognizable at board scale.
 */
const CURSOR_PATH =
  'M0 0 L0 14.2 L3.9 10.9 L7 17.6 L9.2 16.5 L5.9 9.6 L11.2 9.6 Z';

const LABEL_H = 17;
const LABEL_PAD_X = 6;
const LABEL_FONT = 11;
const LABEL_FONT_STACK = 'DM Sans, system-ui, sans-serif';

let measureCtx: CanvasRenderingContext2D | null = null;

function measureNameWidth(name: string): number {
  if (typeof document === 'undefined') return Math.ceil(name.length * 6.8);
  if (!measureCtx) {
    const c = document.createElement('canvas');
    measureCtx = c.getContext('2d');
  }
  if (!measureCtx) return Math.ceil(name.length * 6.8);
  measureCtx.font = `bold ${LABEL_FONT}px ${LABEL_FONT_STACK}`;
  return Math.ceil(measureCtx.measureText(name).width);
}

export const CursorsOverlay = memo(function CursorsOverlay({ users }: { users: RemoteUser[] }) {
  const scale = useViewStore((v) => v.scale);
  const inv = 1 / scale;

  return (
    <>
      {users.map(({ clientId, state }) => (
        <RemoteCursor key={clientId} state={state} inv={inv} />
      ))}
    </>
  );
});

function RemoteCursor({
  state,
  inv,
}: {
  state: RemoteUser['state'];
  inv: number;
}) {
  const { cursor, user, attract, wind, laser } = state;
  const name = (user.name || 'Guest').trim() || 'Guest';
  const labelW = useMemo(() => Math.max(22, measureNameWidth(name) + LABEL_PAD_X * 2), [name]);

  return (
    <Group>
      {laser?.points && laser.points.length >= 4 && (
        <Line
          points={laser.points}
          stroke={laser.color || user.color}
          strokeWidth={2.5 * inv}
          lineCap="round"
          lineJoin="round"
          opacity={0.85}
          listening={false}
        />
      )}
      {cursor && (
        <Group x={cursor.x} y={cursor.y} scaleX={inv} scaleY={inv} listening={false}>
          <Path
            data={CURSOR_PATH}
            fill={user.color}
            stroke="#ffffff"
            strokeWidth={1.15}
            lineJoin="round"
            lineCap="round"
            shadowColor="rgba(0,0,0,0.4)"
            shadowBlur={2.5}
            shadowOffset={{ x: 0.4, y: 0.8 }}
            shadowOpacity={0.5}
          />
          {/* Tip mass marker */}
          <Circle x={1.1} y={1.1} radius={1.35} fill="#ffffff" opacity={0.95} listening={false} />
          <Group x={11} y={12}>
            <Rect
              width={labelW}
              height={LABEL_H}
              fill={user.color}
              cornerRadius={5}
              shadowColor="rgba(0,0,0,0.28)"
              shadowBlur={2}
              shadowOffset={{ x: 0, y: 0.8 }}
              shadowOpacity={0.4}
            />
            <Text
              x={LABEL_PAD_X}
              y={(LABEL_H - LABEL_FONT) / 2 - 0.5}
              text={name}
              fontSize={LABEL_FONT}
              fontStyle="bold"
              fontFamily={LABEL_FONT_STACK}
              fill="#ffffff"
              wrap="none"
              listening={false}
            />
          </Group>
        </Group>
      )}
      {attract && (
        <Group x={attract.x} y={attract.y} listening={false}>
          <Circle radius={26 * inv} stroke={user.color} strokeWidth={3 * inv} opacity={0.9} />
          <Circle radius={46 * inv} stroke={user.color} strokeWidth={1.5 * inv} opacity={0.45} />
          <Text
            x={-6 * inv}
            y={-8 * inv}
            text={attract.dir === 1 ? '+' : '−'}
            fontSize={18 * inv}
            fill={user.color}
            fontStyle="bold"
          />
        </Group>
      )}
      {wind && (
        <Group x={wind.x} y={wind.y} listening={false}>
          <Circle radius={22 * inv} stroke={user.color} strokeWidth={2 * inv} opacity={0.7} dash={[6 * inv, 4 * inv]} />
          <Line
            points={[0, 0, wind.vx * 0.04 * inv, wind.vy * 0.04 * inv]}
            stroke={user.color}
            strokeWidth={3 * inv}
            lineCap="round"
            opacity={0.85}
          />
        </Group>
      )}
    </Group>
  );
}
