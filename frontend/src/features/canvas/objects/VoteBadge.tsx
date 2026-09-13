import type { KonvaEventObject } from 'konva/lib/Node';
import { useState } from 'react';
import { Ellipse, Group, Rect, Text } from 'react-konva';
import type { ObjectVote } from '../../../shared/types';
import { initials } from '../../../shared/utils/votes';

const ROW_H = 22;
const PAD = 8;
const MAX_ROWS = 8;

interface Props {
  voters: ObjectVote[];
  x: number;
  y: number;
}

/**
 * Compact vote count on the canvas. Hover to see who voted (name + color),
 * or a count-only panel when results are anonymous.
 */
export function VoteBadge({ voters, x, y }: Props) {
  const [hover, setHover] = useState(false);
  if (voters.length === 0) return null;

  const anonymous = voters.length > 0 && voters.every((v) => v.name === 'Anonymous');
  const show = anonymous ? voters.slice(0, 1) : voters.slice(0, 3);
  const extra = !anonymous && voters.length > 3;
  const badgeW = 22 + show.length * 12 + (extra ? 10 : 0) + 28;
  const rows = anonymous ? [] : voters.slice(0, MAX_ROWS);
  const overflow = anonymous ? 0 : voters.length - rows.length;
  const nameWidth = anonymous
    ? 120
    : Math.max(120, ...rows.map((v) => Math.min(22, v.name.length) * 7.2 + 36));
  const panelW = Math.min(200, 16 + nameWidth);
  const panelH = anonymous
    ? PAD * 2 + 36
    : PAD * 2 + rows.length * ROW_H + (overflow > 0 ? 18 : 0) + 18;

  const stop = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    e.cancelBubble = true;
  };

  return (
    <Group
      x={x}
      y={y}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={stop}
      onTap={stop}
    >
      <Rect
        width={badgeW}
        height={22}
        cornerRadius={11}
        fill="rgba(28, 31, 40, 0.92)"
        stroke="rgba(255, 255, 255, 0.12)"
        strokeWidth={1}
        shadowColor="rgba(0,0,0,0.35)"
        shadowBlur={6}
        shadowOffsetY={2}
      />
      {show.map((v, i) => (
        <Group key={v.id} x={8 + i * 12} y={11} listening={false}>
          <Ellipse radiusX={7} radiusY={7} fill={v.color} stroke="rgba(18,20,26,0.85)" strokeWidth={1.5} />
        </Group>
      ))}
      <Text
        x={10 + show.length * 12 + (extra ? 6 : 0)}
        y={4}
        text={`${voters.length}`}
        fontSize={12}
        fontStyle="bold"
        fontFamily="DM Sans, system-ui, sans-serif"
        fill="#f3f4f7"
        listening={false}
      />

      {hover && (
        <Group y={26} listening={false}>
          <Rect
            width={panelW}
            height={panelH}
            cornerRadius={10}
            fill="rgba(22, 24, 30, 0.96)"
            stroke="rgba(255, 255, 255, 0.14)"
            strokeWidth={1}
            shadowColor="rgba(0,0,0,0.4)"
            shadowBlur={10}
            shadowOffsetY={3}
          />
          <Text
            x={PAD}
            y={6}
            text={
              anonymous
                ? voters.length === 1
                  ? '1 anonymous vote'
                  : `${voters.length} anonymous votes`
                : voters.length === 1
                  ? '1 vote'
                  : `${voters.length} votes`
            }
            fontSize={11}
            fontStyle="bold"
            fontFamily="DM Sans, system-ui, sans-serif"
            fill="#c8ccd6"
          />
          {rows.map((v, i) => (
            <Group key={v.id} x={PAD} y={22 + i * ROW_H}>
              <Ellipse x={8} y={10} radiusX={8} radiusY={8} fill={v.color} />
              <Text
                x={22}
                y={4}
                width={panelW - 34}
                text={v.name}
                fontSize={12}
                fontFamily="DM Sans, system-ui, sans-serif"
                fill="#f3f4f7"
                ellipsis
                wrap="none"
              />
              <Text
                x={2}
                y={5}
                width={16}
                align="center"
                text={initials(v.name)}
                fontSize={8}
                fontStyle="bold"
                fontFamily="DM Sans, system-ui, sans-serif"
                fill="#fff"
              />
            </Group>
          ))}
          {overflow > 0 && (
            <Text
              x={PAD}
              y={22 + rows.length * ROW_H}
              text={`+${overflow} more`}
              fontSize={11}
              fontFamily="DM Sans, system-ui, sans-serif"
              fill="#9aa1b0"
            />
          )}
        </Group>
      )}
    </Group>
  );
}
