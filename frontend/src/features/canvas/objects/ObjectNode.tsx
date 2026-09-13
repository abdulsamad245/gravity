import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Arrow, Ellipse, Group, Image as KonvaImage, Line, Rect, RegularPolygon, Star, Text } from 'react-konva';
import { DRAG_COMMIT_THROTTLE_MS, DEFAULT_FONT_SIZE, STICKY_FONT_SIZE } from '../../../shared/constants/canvas.constants';
import { DEFAULT_FONT_STACK, EMOJI_FONT_STACK, fontStackFor } from '../../../shared/constants/fonts.constants';
import {
  DEFAULT_OUTLINE,
  GRAVITY,
  SELECTION_STROKE,
} from '../../../shared/constants/colors.constants';
import { PHYSICS } from '../../../shared/constants/physics.constants';
import type { CanvasObject } from '../../../shared/types';
import { resolveMediaUrl } from '../../../shared/utils/media-url';
import { formattedTextContent } from '../../../shared/utils/object-style';
import { throttle } from '../../../shared/utils/throttle';
import { normalizeVotes } from '../../../shared/utils/votes';
import { ChartContent } from './ChartContent';
import { CodeBlockContent } from './CodeBlockContent';
import { DiagramFrameContent, type DiagramQuickStart } from './DiagramFrameContent';
import { VoteBadge } from './VoteBadge';

export interface ObjectCallbacks {
  onSelect: (id: string, additive?: boolean) => void;
  onCommit: (id: string, patch: Partial<CanvasObject>) => void;
  onImpulse: (id: string, vx: number, vy: number) => void;
  onEditText: (id: string) => void;
  onDiagramAction?: (id: string, action: DiagramQuickStart) => void;
}

interface Props extends ObjectCallbacks {
  obj: CanvasObject;
  interactive: boolean;
  selected?: boolean;
}

/** Pointer samples used to derive throw velocity on drag release. */
interface Sample {
  t: number;
  x: number;
  y: number;
}

/**
 * The node is a Group positioned at the object's CENTER with content drawn
 * around the origin - so Konva rotation and Matter.js body rotation share
 * the same pivot, and no coordinate conversion is needed between them.
 *
 * Memoized: with per-key stability from useObjects, unchanged objects skip re-render.
 */
export const ObjectNode = memo(function ObjectNode({
  obj,
  interactive,
  selected = false,
  onSelect,
  onCommit,
  onImpulse,
  onEditText,
  onDiagramAction,
}: Props) {
  const samples = useRef<Sample[]>([]);

  const commitDrag = useMemo(
    () => throttle((patch: Partial<CanvasObject>) => onCommit(obj.id, patch), DRAG_COMMIT_THROTTLE_MS),
    [obj.id, onCommit],
  );

  const halfW = obj.width / 2;
  const halfH = obj.height / 2;

  const handleDragMove = (e: KonvaEventObject<DragEvent>) => {
    const { x, y } = e.target.position();
    samples.current.push({ t: performance.now(), x, y });
    if (samples.current.length > 8) samples.current.shift();
    commitDrag({ x: x - halfW, y: y - halfH });
  };

  const handleDragEnd = (e: KonvaEventObject<DragEvent>) => {
    const { x, y } = e.target.position();
    onCommit(obj.id, { x: x - halfW, y: y - halfH });

    // Throw: derive pointer velocity from the recent drag samples.
    if (obj.physics && samples.current.length >= 2) {
      const first = samples.current[0];
      const last = samples.current[samples.current.length - 1];
      const dt = (last.t - first.t) / 1000;
      if (dt > 0) {
        const vx = (last.x - first.x) / dt;
        const vy = (last.y - first.y) / dt;
        if (Math.hypot(vx, vy) >= PHYSICS.THROW_MIN_SPEED) {
          onImpulse(obj.id, vx * PHYSICS.THROW_SCALE, vy * PHYSICS.THROW_SCALE);
        }
      }
    }
    samples.current = [];
  };

  const handleTransformEnd = (e: KonvaEventObject<Event>) => {
    const node = e.target as Konva.Group;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scale({ x: 1, y: 1 });
    const width = Math.max(12, obj.width * scaleX);
    const height = Math.max(12, obj.height * scaleY);
    const pos = node.position();
    onCommit(obj.id, {
      x: pos.x - width / 2,
      y: pos.y - height / 2,
      width,
      height,
      rotation: node.rotation(),
      // Freehand strokes scale their points with the bounding box.
      ...(obj.points
        ? { points: obj.points.map((p, i) => (i % 2 === 0 ? p * scaleX : p * scaleY)) }
        : {}),
      ...((obj.type === 'text' || obj.type === 'code') && obj.fontSize
        ? { fontSize: Math.max(8, obj.fontSize * scaleY) }
        : {}),
    });
  };

  const select = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!interactive) return;
    e.cancelBubble = true;
    const ev = e.evt as MouseEvent;
    // Shift or Ctrl/Cmd adds this object to the current selection.
    const additive = !!(ev.shiftKey || ev.ctrlKey || ev.metaKey);
    onSelect(obj.id, additive);
  };

  return (
    <Group
      id={`obj-${obj.id}`}
      x={obj.x + halfW}
      y={obj.y + halfH}
      rotation={obj.rotation}
      opacity={typeof obj.opacity === 'number' ? obj.opacity : 1}
      draggable={interactive && !obj.locked && !obj.privateHidden}
      // Keep listening in view mode so vote badges can show voter details on hover.
      listening={!obj.privateHidden}
      onClick={select}
      onTap={select}
      onDragStart={select}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onTransformEnd={handleTransformEnd}
      onDblClick={() =>
        interactive &&
        !obj.privateHidden &&
        (obj.type === 'rect' || obj.type === 'text' || obj.type === 'sticky' || obj.type === 'frame' || obj.type === 'table' || obj.type === 'code') &&
        onEditText(obj.id)
      }
      onDblTap={() =>
        interactive &&
        !obj.privateHidden &&
        (obj.type === 'rect' || obj.type === 'text' || obj.type === 'sticky' || obj.type === 'frame' || obj.type === 'table' || obj.type === 'code') &&
        onEditText(obj.id)
      }
    >
      <ObjectContent
        obj={obj}
        halfW={halfW}
        halfH={halfH}
        onDiagramAction={
          onDiagramAction ? (action) => onDiagramAction(obj.id, action) : undefined
        }
      />
      {selected && (
        <Rect
          x={-halfW - 3}
          y={-halfH - 3}
          width={obj.width + 6}
          height={obj.height + 6}
          stroke={SELECTION_STROKE}
          strokeWidth={2}
          dash={obj.role === 'diagram' ? undefined : [6, 4]}
          listening={false}
        />
      )}
      {(() => {
        const voters = normalizeVotes(obj.votes);
        if (voters.length === 0) return null;
        const show = Math.min(3, voters.length);
        const badgeW = 22 + show * 12 + (voters.length > 3 ? 10 : 0) + 28;
        return <VoteBadge voters={voters} x={halfW - badgeW + 4} y={-halfH - 22} />;
      })()}
    </Group>
  );
});

function ObjectContent({
  obj,
  halfW,
  halfH,
  onDiagramAction,
}: {
  obj: CanvasObject;
  halfW: number;
  halfH: number;
  onDiagramAction?: (action: DiagramQuickStart) => void;
}) {
  switch (obj.type) {
    case 'rect':
      return (
        <>
          <Rect
            x={-halfW}
            y={-halfH}
            width={obj.width}
            height={obj.height}
            fill={obj.fill}
            cornerRadius={obj.mindMapId ? 18 : 10}
            stroke={obj.stroke}
            strokeWidth={obj.strokeWidth ?? 0}
          />
          {!!obj.text && (
            <Text
              x={-halfW + 10}
              y={-halfH + 8}
              width={obj.width - 20}
              height={obj.height - 16}
              text={obj.text}
              fontSize={obj.fontSize ?? 16}
              fontFamily={fontStackFor(obj.fontFamily) || DEFAULT_FONT_STACK}
              fontStyle={obj.fontStyle ?? 'normal'}
              align={obj.align ?? 'center'}
              verticalAlign="middle"
              fill={obj.textColor ?? '#ffffff'}
              wrap="word"
            />
          )}
        </>
      );
    case 'ellipse':
      return (
        <>
          <Ellipse
            radiusX={halfW}
            radiusY={halfH}
            fill={obj.fill}
            stroke={obj.role === 'magnet' ? '#fff' : obj.stroke}
            strokeWidth={obj.role === 'magnet' ? 3 : (obj.strokeWidth ?? 0)}
            dash={obj.role === 'magnet' ? [8, 6] : undefined}
          />
          {obj.role === 'magnet' && (
            <>
              <Ellipse
                radiusX={halfW + 10}
                radiusY={halfH + 10}
                stroke={obj.fill || GRAVITY.flare}
                strokeWidth={2}
                opacity={0.45}
                listening={false}
              />
              <Text
                x={-halfW}
                y={-10}
                width={obj.width}
                align="center"
                text={obj.text || 'Magnet'}
                fontSize={13}
                fontStyle="bold"
                fontFamily={DEFAULT_FONT_STACK}
                fill={obj.textColor ?? '#ffffff'}
                listening={false}
              />
            </>
          )}
        </>
      );
    case 'triangle':
      return (
        <RegularPolygon
          sides={3}
          radius={Math.min(halfW, halfH)}
          fill={obj.fill}
          stroke={obj.stroke}
          strokeWidth={obj.strokeWidth ?? 0}
        />
      );
    case 'diamond':
      return (
        <Line
          points={[0, -halfH, halfW, 0, 0, halfH, -halfW, 0]}
          closed
          fill={obj.fill}
          stroke={obj.stroke}
          strokeWidth={obj.strokeWidth ?? 0}
        />
      );
    case 'star':
      return (
        <Star
          numPoints={5}
          innerRadius={Math.min(halfW, halfH) * 0.45}
          outerRadius={Math.min(halfW, halfH)}
          fill={obj.fill}
          stroke={obj.stroke}
          strokeWidth={obj.strokeWidth ?? 0}
        />
      );
    case 'hexagon':
      return (
        <RegularPolygon
          sides={6}
          radius={Math.min(halfW, halfH)}
          fill={obj.fill}
          stroke={obj.stroke}
          strokeWidth={obj.strokeWidth ?? 0}
        />
      );
    case 'line':
      return (
        <Line
          points={[-halfW, 0, halfW, 0]}
          stroke={obj.stroke ?? obj.fill}
          strokeWidth={obj.strokeWidth ?? 2}
          lineCap="round"
        />
      );
    case 'divider':
      return (
        <Line
          points={[-halfW, 0, halfW, 0]}
          stroke={obj.stroke ?? obj.fill}
          strokeWidth={obj.strokeWidth ?? 2}
          lineCap="round"
        />
      );
    case 'arrow':
      return (
        <Arrow
          points={[-halfW, 0, halfW, 0]}
          stroke={obj.stroke ?? obj.fill}
          fill={obj.stroke ?? obj.fill}
          strokeWidth={obj.strokeWidth ?? 2}
          pointerLength={14}
          pointerWidth={12}
          lineCap="round"
        />
      );
    case 'elbowArrow':
      return (
        <Arrow
          points={[-halfW, halfH * 0.55, -halfW, -halfH * 0.15, halfW, -halfH * 0.15]}
          stroke={obj.stroke ?? obj.fill}
          fill={obj.stroke ?? obj.fill}
          strokeWidth={obj.strokeWidth ?? 2}
          pointerLength={14}
          pointerWidth={12}
          lineCap="round"
          lineJoin="round"
        />
      );
    case 'blockArrow': {
      const bodyTop = -halfH * 0.38;
      const bodyBot = halfH * 0.38;
      const neck = halfW * 0.15;
      return (
        <Line
          points={[
            -halfW,
            bodyTop,
            neck,
            bodyTop,
            neck,
            -halfH,
            halfW,
            0,
            neck,
            halfH,
            neck,
            bodyBot,
            -halfW,
            bodyBot,
          ]}
          closed
          fill={obj.fill}
          stroke={obj.stroke ?? obj.fill}
          strokeWidth={obj.strokeWidth ?? 2}
          lineJoin="round"
        />
      );
    }
    case 'sticky':
      return (
        <>
          <Rect
            x={-halfW}
            y={-halfH}
            width={obj.width}
            height={obj.height}
            fill={obj.fill}
            cornerRadius={6}
            shadowColor="black"
            shadowBlur={12}
            shadowOpacity={0.35}
            shadowOffsetY={4}
          />
          {obj.highlight && (
            <Rect
              x={-halfW + 8}
              y={-halfH + 10}
              width={obj.width - 16}
              height={Math.min(obj.height - 20, (obj.fontSize ?? STICKY_FONT_SIZE) * 1.6 + 8)}
              fill={obj.highlight}
              opacity={0.55}
              cornerRadius={4}
              listening={false}
            />
          )}
          <Text
            x={-halfW}
            y={-halfH}
            width={obj.width}
            height={obj.height}
            padding={14}
            text={formattedTextContent(obj, 'Double-click to edit')}
            fontSize={obj.fontSize ?? STICKY_FONT_SIZE}
            fontFamily={fontStackFor(obj.fontFamily) || DEFAULT_FONT_STACK}
            fontStyle={obj.fontStyle ?? 'normal'}
            textDecoration={obj.textDecoration && obj.textDecoration !== 'none' ? obj.textDecoration : undefined}
            align={obj.align ?? 'left'}
            fill={obj.textColor ?? '#2b2b2b'}
            wrap="word"
            ellipsis
          />
        </>
      );
    case 'text':
      return (
        <>
          {obj.highlight && (
            <Rect
              x={-halfW}
              y={-halfH}
              width={obj.width}
              height={Math.max(28, (obj.fontSize ?? DEFAULT_FONT_SIZE) * 1.45)}
              fill={obj.highlight}
              opacity={0.55}
              cornerRadius={3}
              listening={false}
            />
          )}
          <Text
            x={-halfW}
            y={-halfH}
            width={obj.width}
            text={formattedTextContent(obj, 'Double-click to edit')}
            fontSize={obj.fontSize ?? DEFAULT_FONT_SIZE}
            fontFamily={fontStackFor(obj.fontFamily) || DEFAULT_FONT_STACK}
            fontStyle={obj.fontStyle ?? 'normal'}
            textDecoration={obj.textDecoration && obj.textDecoration !== 'none' ? obj.textDecoration : undefined}
            align={obj.align ?? 'left'}
            fill={obj.fill}
            wrap="word"
          />
        </>
      );
    case 'code':
      return <CodeBlockContent obj={obj} halfW={halfW} halfH={halfH} />;
    case 'frame':
      if (obj.role === 'diagram') {
        return (
          <DiagramFrameContent
            obj={obj}
            halfW={halfW}
            halfH={halfH}
            onQuickStart={onDiagramAction}
          />
        );
      }
      return (
        <>
          <Rect
            x={-halfW}
            y={-halfH}
            width={obj.width}
            height={obj.height}
            fill={obj.fill}
            stroke={obj.role === 'archiveWell' ? GRAVITY.danger : (obj.stroke ?? GRAVITY.link)}
            strokeWidth={obj.strokeWidth ?? 2}
            cornerRadius={8}
            dash={obj.role === 'archiveWell' ? [10, 8] : undefined}
          />
          {obj.role === 'archiveWell' && (
            <Ellipse
              radiusX={Math.min(halfW, halfH) * 0.42}
              radiusY={Math.min(halfW, halfH) * 0.28}
              fill="rgba(255, 92, 106, 0.2)"
              stroke={GRAVITY.danger}
              strokeWidth={1.5}
              listening={false}
            />
          )}
          <Text
            x={-halfW + 10}
            y={-halfH + 8}
            width={obj.width - 20}
            text={formattedTextContent(
              obj,
              obj.role === 'archiveWell' ? 'Archive well' : 'Frame',
            )}
            fontSize={obj.fontSize ?? 16}
            fontFamily={fontStackFor(obj.fontFamily) || DEFAULT_FONT_STACK}
            fontStyle={obj.fontStyle ?? 'normal'}
            textDecoration={obj.textDecoration && obj.textDecoration !== 'none' ? obj.textDecoration : undefined}
            align={obj.align ?? 'left'}
            fill={obj.textColor ?? obj.stroke ?? (obj.role === 'archiveWell' ? '#ffc9ce' : GRAVITY.link)}
          />
        </>
      );
    case 'table':
      return <TableContent obj={obj} halfW={halfW} halfH={halfH} />;
    case 'chart':
      return <ChartContent obj={obj} halfW={halfW} halfH={halfH} />;
    case 'stamp':
      return <StampContent obj={obj} halfW={halfW} halfH={halfH} />;
    case 'path':
      return (
        <Line
          x={-halfW}
          y={-halfH}
          points={obj.points ?? []}
          stroke={obj.stroke ?? obj.fill}
          strokeWidth={obj.strokeWidth ?? 4}
          lineCap="round"
          lineJoin="round"
          tension={0.4}
        />
      );
    case 'image':
      return <ImageContent obj={obj} halfW={halfW} halfH={halfH} />;
    case 'video':
    case 'file':
      return <ImageContent obj={obj} halfW={halfW} halfH={halfH} />;
    case 'audio':
      return <AudioContent obj={obj} halfW={halfW} halfH={halfH} />;
    case 'embed':
      return (
        <Group listening>
          <Rect
            x={-halfW}
            y={-halfH}
            width={obj.width}
            height={obj.height}
            fill="rgba(28, 31, 40, 0.92)"
            stroke={obj.stroke ?? '#5b6478'}
            strokeWidth={obj.strokeWidth ?? 1.5}
            cornerRadius={10}
          />
          <Text
            x={-halfW + 12}
            y={-halfH + 10}
            width={obj.width - 24}
            text="Web embed"
            fontSize={12}
            fontStyle="bold"
            fontFamily="DM Sans, system-ui, sans-serif"
            fill="#c8ccd6"
          />
          <Text
            x={-halfW + 12}
            y={-halfH + 28}
            width={obj.width - 24}
            height={Math.max(24, obj.height - 40)}
            text={obj.src || obj.text || 'No URL'}
            fontSize={12}
            fontFamily="DM Sans, system-ui, sans-serif"
            fill="#9aa1b0"
            wrap="none"
            ellipsis
          />
        </Group>
      );
    default:
      return null;
  }
}

/**
 * Draw stamp emoji to a canvas bitmap. Konva Text + UI fonts often skip color
 * emoji on Windows, so stamps looked selected but invisible on the board.
 */
function StampContent({ obj, halfW, halfH }: { obj: CanvasObject; halfW: number; halfH: number }) {
  const [image, setImage] = useState<HTMLCanvasElement | null>(null);
  const glyph = obj.text || '⭐';
  const size = Math.max(12, Math.min(obj.width, obj.height));

  useEffect(() => {
    const canvas = document.createElement('canvas');
    const dpr = Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 2);
    const px = Math.max(1, Math.ceil(size * dpr));
    canvas.width = px;
    canvas.height = px;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, size, size);
    ctx.font = `${size * 0.78}px ${EMOJI_FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(glyph, size / 2, size / 2 + size * 0.03);
    setImage(canvas);
  }, [glyph, size]);

  if (!image) {
    return (
      <Text
        x={-halfW}
        y={-halfH}
        width={obj.width}
        height={obj.height}
        text={glyph}
        fontSize={size * 0.7}
        fontFamily={EMOJI_FONT_STACK}
        align="center"
        verticalAlign="middle"
        fill={obj.fill || '#e9ecef'}
      />
    );
  }
  return <KonvaImage image={image} x={-halfW} y={-halfH} width={obj.width} height={obj.height} />;
}

function ImageContent({ obj, halfW, halfH }: { obj: CanvasObject; halfW: number; halfH: number }) {
  // Visible pixels come from ImageObjectsOverlay (CORS-safe + animated GIFs).
  // Konva keeps a hit target so drag / select still work.
  return (
    <Rect
      x={-halfW}
      y={-halfH}
      width={obj.width}
      height={obj.height}
      fill="rgba(42, 45, 58, 0.35)"
      cornerRadius={8}
      stroke={obj.stroke}
      strokeWidth={obj.strokeWidth ?? 0}
    />
  );
}

/** Shared audio elements so replays/re-renders don't spawn duplicate playback. */
const audioElements = new Map<string, HTMLAudioElement>();

function AudioContent({ obj, halfW, halfH }: { obj: CanvasObject; halfW: number; halfH: number }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const playCx = -halfW + obj.height / 2;
  const barCount = 10;
  const waveX = -halfW + obj.height + 4;
  const waveW = Math.max(36, obj.width - obj.height - 44);
  const barGap = 2;
  const barW = Math.max(2, (waveW - barGap * (barCount - 1)) / barCount);
  const totalSec = Math.round(obj.audioDuration ?? 0);

  const setPointer = (e: KonvaEventObject<MouseEvent>, cursor: string) => {
    const stage = e.target.getStage();
    if (stage) stage.container().style.cursor = cursor;
  };

  useEffect(() => {
    if (!playing) return;
    const el = audioElements.get(obj.id);
    if (!el) return;
    let raf = 0;
    const tick = () => {
      const dur = el.duration || obj.audioDuration || 0;
      setProgress(dur > 0 ? Math.min(1, el.currentTime / dur) : 0);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, obj.id, obj.audioDuration]);

  const toggle = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    e.cancelBubble = true;
    if (!obj.audio) return;
    let el = audioElements.get(obj.id);
    if (!el) {
      el = new Audio(resolveMediaUrl(obj.audio));
      audioElements.set(obj.id, el);
    }
    el.onended = () => {
      setPlaying(false);
      setProgress(0);
    };
    if (playing) {
      el.pause();
      el.currentTime = 0;
      setPlaying(false);
      setProgress(0);
    } else {
      void el.play();
      setPlaying(true);
    }
  };

  const playedThrough = progress * barCount;
  const timeText =
    playing && totalSec > 0
      ? `${Math.max(0, totalSec - Math.round(progress * totalSec))}s`
      : `${totalSec}s`;

  return (
    <>
      <Rect
        x={-halfW}
        y={-halfH}
        width={obj.width}
        height={obj.height}
        fill="#f3f4f7"
        stroke={GRAVITY.flare}
        strokeWidth={1.5}
        cornerRadius={obj.height / 2}
        shadowColor="rgba(0,0,0,0.4)"
        shadowBlur={8}
        shadowOpacity={0.28}
        shadowOffsetY={1}
      />
      <Group
        onClick={toggle}
        onTap={toggle}
        onMouseEnter={(e) => setPointer(e, 'pointer')}
        onMouseLeave={(e) => setPointer(e, 'default')}
      >
        <Ellipse x={playCx} radiusX={obj.height * 0.32} radiusY={obj.height * 0.32} fill={GRAVITY.flare} />
        {playing ? (
          <Rect x={playCx - 4} y={-4} width={8} height={8} fill={GRAVITY.ink} cornerRadius={1.5} />
        ) : (
          <Line points={[playCx - 3, -5, playCx - 3, 5, playCx + 6, 0]} closed fill={GRAVITY.ink} />
        )}
      </Group>
      {Array.from({ length: barCount }, (_, i) => {
        const seed = (obj.id.charCodeAt(i % obj.id.length) || 1) % 7;
        const h = obj.height * (0.28 + (seed / 7) * 0.45);
        const played = i < playedThrough;
        return (
          <Rect
            key={i}
            x={waveX + i * (barW + barGap)}
            y={-h / 2}
            width={barW}
            height={h}
            cornerRadius={1}
            fill={played ? GRAVITY.flare : DEFAULT_OUTLINE}
            opacity={played ? 0.95 : 0.7}
          />
        );
      })}
      <Text
        x={waveX + waveW + 4}
        y={-6}
        text={timeText}
        fontSize={11}
        fontStyle="bold"
        fontFamily="DM Sans, system-ui, sans-serif"
        fill={GRAVITY.ink}
      />
    </>
  );
}

function TableContent({ obj, halfW, halfH }: { obj: CanvasObject; halfW: number; halfH: number }) {
  if (obj.records) {
    const records = obj.records.slice(0, 8);
    const mode = obj.dataView ?? 'table';
    const headerH = 30;
    const bodyTop = -halfH + headerH;
    const statuses = Array.from(new Set(records.map((record) => record.status || 'Unassigned'))).slice(0, 4);
    return (
      <>
        <Rect
          x={-halfW}
          y={-halfH}
          width={obj.width}
          height={obj.height}
          fill={obj.fill}
          stroke={obj.stroke ?? GRAVITY.link}
          strokeWidth={1}
          cornerRadius={6}
        />
        <Text
          x={-halfW + 10}
          y={-halfH + 8}
          text={mode === 'table' ? 'TABLE' : mode === 'kanban' ? 'KANBAN' : 'TIMELINE'}
          fontSize={11}
          fontStyle="bold"
          fill="#74c0fc"
        />
        {mode === 'table' &&
          records.map((record, index) => {
            const rowH = (obj.height - headerH) / Math.max(1, records.length);
            return (
              <Group key={record.id}>
                <Rect
                  x={-halfW}
                  y={bodyTop + index * rowH}
                  width={obj.width}
                  height={rowH}
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth={1}
                />
                <Text
                  x={-halfW + 8}
                  y={bodyTop + index * rowH + 6}
                  width={obj.width * 0.55}
                  text={record.title}
                  fontSize={12}
                  fill="#e8ecf1"
                  ellipsis
                />
                <Text
                  x={-halfW + obj.width * 0.6}
                  y={bodyTop + index * rowH + 6}
                  width={obj.width * 0.35}
                  text={record.status}
                  fontSize={11}
                  fill={DEFAULT_OUTLINE}
                  ellipsis
                />
              </Group>
            );
          })}
        {mode === 'kanban' &&
          statuses.map((status, columnIndex) => {
            const columnW = obj.width / Math.max(1, statuses.length);
            const cards = records.filter((record) => (record.status || 'Unassigned') === status);
            return (
              <Group key={status}>
                <Text
                  x={-halfW + columnIndex * columnW + 6}
                  y={bodyTop + 5}
                  width={columnW - 12}
                  text={status}
                  fontSize={11}
                  fontStyle="bold"
                  fill={DEFAULT_OUTLINE}
                  ellipsis
                />
                {cards.slice(0, 4).map((record, cardIndex) => (
                  <Group key={record.id}>
                    <Rect
                      x={-halfW + columnIndex * columnW + 6}
                      y={bodyTop + 24 + cardIndex * 38}
                      width={columnW - 12}
                      height={31}
                      fill="rgba(61,139,253,0.14)"
                      cornerRadius={4}
                    />
                    <Text
                      x={-halfW + columnIndex * columnW + 11}
                      y={bodyTop + 33 + cardIndex * 38}
                      width={columnW - 22}
                      text={record.title}
                      fontSize={11}
                      fill="#e8ecf1"
                      ellipsis
                    />
                  </Group>
                ))}
              </Group>
            );
          })}
        {mode === 'timeline' &&
          records.map((record, index) => {
            const rowH = (obj.height - headerH) / Math.max(1, records.length);
            const offset = (index % 4) * (obj.width * 0.08);
            return (
              <Group key={record.id}>
                <Text
                  x={-halfW + 7}
                  y={bodyTop + index * rowH + 5}
                  width={obj.width * 0.32}
                  text={record.title}
                  fontSize={10}
                  fill="#e8ecf1"
                  ellipsis
                />
                <Rect
                  x={-halfW + obj.width * 0.35 + offset}
                  y={bodyTop + index * rowH + 6}
                  width={obj.width * 0.42}
                  height={Math.max(8, rowH - 12)}
                  fill={GRAVITY.link}
                  cornerRadius={4}
                />
              </Group>
            );
          })}
      </>
    );
  }
  const rows = (obj.cells || ',,\n,,\n,,').split('\n').map((r) => r.split(','));
  const cols = Math.max(1, ...rows.map((r) => r.length));
  const cellW = obj.width / cols;
  const cellH = obj.height / Math.max(1, rows.length);
  return (
    <>
      <Rect
        x={-halfW}
        y={-halfH}
        width={obj.width}
        height={obj.height}
        fill={obj.fill}
        stroke={obj.stroke ?? GRAVITY.link}
        strokeWidth={1}
        cornerRadius={6}
      />
      {rows.map((row, ri) =>
        row.map((cell, ci) => (
          <Group key={`${ri}-${ci}`}>
            <Rect
              x={-halfW + ci * cellW}
              y={-halfH + ri * cellH}
              width={cellW}
              height={cellH}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={1}
            />
            <Text
              x={-halfW + ci * cellW + 6}
              y={-halfH + ri * cellH + 8}
              width={cellW - 12}
              height={cellH - 12}
              text={cell}
              fontSize={12}
              fontFamily="DM Sans, system-ui, sans-serif"
              fill="#e8ecf1"
              wrap="word"
            />
          </Group>
        )),
      )}
    </>
  );
}
