import type { KonvaEventObject } from 'konva/lib/Node';
import { Ellipse, Group, Rect, Text } from 'react-konva';
import { ASSISTANT_NAME } from '../../../shared/constants/app.constants';
import { GRAVITY } from '../../../shared/constants/colors.constants';
import type { CanvasObject } from '../../../shared/types';

export type DiagramQuickStart = 'shapes' | 'template' | 'ai';

interface Props {
  obj: CanvasObject;
  halfW: number;
  halfH: number;
  onQuickStart?: (action: DiagramQuickStart) => void;
}

const ACCENT = GRAVITY.flare;
const INK = '#1c1c1e';
const MUTED = '#5c6475';
const CARD_W = 118;
const CARD_H = 96;
const CARD_GAP = 12;

function OrbitMark({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <Group x={x} y={y} scaleX={scale} scaleY={scale} listening={false}>
      <Ellipse
        x={0}
        y={0}
        radiusX={7.2}
        radiusY={2.8}
        rotation={-32}
        stroke={ACCENT}
        strokeWidth={1.4}
        fillEnabled={false}
      />
      <Ellipse x={0} y={0} radiusX={3.5} radiusY={3.5} fill={ACCENT} />
      <Ellipse x={0} y={0} radiusX={3.5} radiusY={1.25} stroke="rgba(18,20,26,0.28)" strokeWidth={0.7} fillEnabled={false} />
      <Ellipse x={5.2} y={-3.2} radiusX={1.2} radiusY={1.2} fill={ACCENT} />
    </Group>
  );
}

export function DiagramFrameContent({ obj, halfW, halfH, onQuickStart }: Props) {
  const empty = obj.diagramEmpty === true;
  const pad = 14;
  const label = obj.text || 'Diagram';
  const labelW = Math.min(160, 28 + label.length * 8.2 + 36);

  const cards: { id: DiagramQuickStart; title: string }[] = [
    { id: 'shapes', title: 'Add shapes' },
    { id: 'template', title: 'Start with a template' },
    { id: 'ai', title: `Create with ${ASSISTANT_NAME}` },
  ];
  const rowW = cards.length * CARD_W + (cards.length - 1) * CARD_GAP;
  const rowX = -rowW / 2;
  const rowY = -8;

  const stop = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    e.cancelBubble = true;
  };

  return (
    <>
      {/* Outer boundary */}
      <Rect
        x={-halfW}
        y={-halfH}
        width={obj.width}
        height={obj.height}
        fill={obj.fill || '#ffffff'}
        stroke={obj.stroke ?? '#c5cad3'}
        strokeWidth={obj.strokeWidth ?? 1.5}
        cornerRadius={6}
      />
      {/* Inner dashed boundary */}
      <Rect
        x={-halfW + pad}
        y={-halfH + pad}
        width={obj.width - pad * 2}
        height={obj.height - pad * 2}
        fillEnabled={false}
        stroke="#d5d9e2"
        strokeWidth={1.25}
        dash={[7, 5]}
        cornerRadius={4}
        listening={false}
      />

      {/* Floating label pill (sits on the top edge) */}
      <Group x={-halfW + 8} y={-halfH - 13} listening={false}>
        <Rect
          width={labelW}
          height={26}
          cornerRadius={8}
          fill="#ffffff"
          stroke="#e0e2e8"
          strokeWidth={1}
          shadowColor="rgba(18,20,26,0.12)"
          shadowBlur={4}
          shadowOffsetY={1}
        />
        <OrbitMark x={14} y={13} scale={0.95} />
        <Text
          x={26}
          y={6}
          text={label}
          fontSize={12}
          fontStyle="bold"
          fontFamily="DM Sans, system-ui, sans-serif"
          fill={INK}
        />
      </Group>

      {empty && (
        <Group>
          <Text
            x={-halfW + 24}
            y={rowY - 36}
            width={obj.width - 48}
            align="center"
            text="Drag and drop shapes here or choose a quick start"
            fontSize={13}
            fontFamily="DM Sans, system-ui, sans-serif"
            fill={MUTED}
            listening={false}
          />
          {cards.map((card, i) => {
            const cx = rowX + i * (CARD_W + CARD_GAP);
            return (
              <Group
                key={card.id}
                x={cx}
                y={rowY}
                onClick={(e) => {
                  stop(e);
                  onQuickStart?.(card.id);
                }}
                onTap={(e) => {
                  stop(e);
                  onQuickStart?.(card.id);
                }}
              >
                <Rect
                  width={CARD_W}
                  height={CARD_H}
                  cornerRadius={12}
                  fill={i === 1 ? '#f3f4f7' : '#ffffff'}
                  stroke="#d5d9e2"
                  strokeWidth={1.25}
                />
                <QuickStartIcon kind={card.id} x={CARD_W / 2} y={34} />
                <Text
                  x={8}
                  y={58}
                  width={CARD_W - 16}
                  align="center"
                  text={card.title}
                  fontSize={11}
                  fontStyle="bold"
                  fontFamily="DM Sans, system-ui, sans-serif"
                  fill={INK}
                  listening={false}
                />
              </Group>
            );
          })}
        </Group>
      )}
    </>
  );
}

function QuickStartIcon({ kind, x, y }: { kind: DiagramQuickStart; x: number; y: number }) {
  if (kind === 'shapes') {
    return (
      <Group x={x} y={y} listening={false}>
        <Rect x={-16} y={-10} width={14} height={14} cornerRadius={2} stroke={ACCENT} strokeWidth={1.6} fillEnabled={false} />
        <Ellipse x={8} y={-2} radiusX={7} radiusY={7} stroke={ACCENT} strokeWidth={1.6} fillEnabled={false} />
        <Rect x={-2} y={6} width={12} height={3} fill={ACCENT} cornerRadius={1} />
      </Group>
    );
  }
  if (kind === 'template') {
    return (
      <Group x={x} y={y} listening={false}>
        <Rect x={-14} y={-12} width={28} height={24} cornerRadius={3} stroke={ACCENT} strokeWidth={1.6} fillEnabled={false} />
        <Rect x={-10} y={-8} width={8} height={6} fill={ACCENT} opacity={0.85} cornerRadius={1} />
        <Rect x={2} y={-8} width={8} height={6} fill={ACCENT} opacity={0.55} cornerRadius={1} />
        <Rect x={-10} y={2} width={8} height={6} fill={ACCENT} opacity={0.55} cornerRadius={1} />
        <Rect x={2} y={2} width={8} height={6} fill={ACCENT} opacity={0.35} cornerRadius={1} />
      </Group>
    );
  }
  // Sparkle glyph used for assistant-generated diagram frames.
  return (
    <Group x={x} y={y} listening={false}>
      <Text x={-11} y={-16} text="✦" fontSize={22} fill={ACCENT} />
      <Text x={6} y={-6} text="✧" fontSize={12} fill={ACCENT} />
      <Ellipse x={-8} y={8} radiusX={1.6} radiusY={1.6} fill={ACCENT} />
    </Group>
  );
}
