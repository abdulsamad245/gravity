import Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Layer, Rect, Stage, Transformer } from 'react-konva';
import { nanoid } from 'nanoid';
import {
  AWARENESS_THROTTLE_MS,
  DEFAULT_TABLE_CELLS,
  DEFAULTS,
  DEFAULT_FONT_SIZE,
  HIGHLIGHTER_OPACITY,
  HIGHLIGHTER_STROKE,
  OBJECT_ID_LENGTH,
  PEN_COMMIT_THROTTLE_MS,
  PEN_STROKE_WIDTH,
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_STEP,
} from '../../shared/constants/canvas.constants';
import {
  SELECTION_STROKE,
  shapePaintFromFill,
  STICKY_COLORS,
  strokeFromFill,
} from '../../shared/constants/colors.constants';
import type { CanvasObject } from '../../shared/types';
import { clamp } from '../../shared/utils/geometry';
import { throttle } from '../../shared/utils/throttle';
import { canvasThemeColors, useThemeStore } from '../../stores/theme.store';
import { useViewStore } from '../../stores/view.store';
import { useUiStore } from '../../stores/ui.store';
import { CursorsOverlay } from '../collaboration/CursorsOverlay';
import type { RemoteUser } from '../collaboration/useAwareness';
import type { RoomConnection } from '../collaboration/RoomConnection';
import { placeArchiveWell, placeMagnet } from '../physics/physics-actions';
import { makeCommentDraft } from './CommentsLayer';
import { GridLayer } from './GridLayer';
import { ConnectorLayer } from './objects/ConnectorLayer';
import { ObjectNode } from './objects/ObjectNode';
import type { DiagramQuickStart } from './objects/DiagramFrameContent';
import { createCodeObject } from './code-object';
import { createMindMapRoot, isMindMapBranchHidden } from './mind-map';
import { MindMapLayer } from './objects/MindMapLayer';

interface Props {
  conn: RoomConnection;
  objects: Record<string, CanvasObject>;
  remoteUsers: RemoteUser[];
  interactive: boolean;
  stageRef: RefObject<Konva.Stage | null>;
  /** When set, hide Transformer chrome so HTML editors align to the object edge. */
  editingId?: string | null;
  onEditText: (id: string | null) => void;
  onDiagramAction?: (id: string, action: DiagramQuickStart) => void;
  onContextMenu?: (info: {
    screen: { x: number; y: number };
    world: { x: number; y: number };
    targetId: string | null;
  }) => void;
}

/**
 * Main Konva stage: tools, pan, marquee, and object creation.
 * Empty-canvas hits must check `e.target === stage` so object drags do not pan/marquee.
 */
export function CanvasStage({
  conn,
  objects,
  remoteUsers,
  interactive,
  stageRef,
  editingId = null,
  onEditText,
  onDiagramAction,
  onContextMenu,
}: Props) {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [spaceDown, setSpaceDown] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const view = useViewStore();
  const setView = useViewStore((s) => s.setView);
  const {
    tool,
    selectedId,
    selectedIds,
    fillColor,
    stampGlyph,
    stampGifSrc,
    canvasBg,
    setTool,
    setSelectedId,
    setSelectedIds,
    addSelectedIds,
    toggleSelectedId,
  } = useUiStore();
  const theme = useThemeStore((s) => s.resolved);
  const { bg: stageBg } = canvasThemeColors(theme, canvasBg);

  const transformerRef = useRef<Konva.Transformer>(null);
  const penRef = useRef<{ id: string; x: number; y: number; points: number[] } | null>(null);
  const pinchRef = useRef<{ dist: number } | null>(null);
  const connectorFromRef = useRef<string | null>(null);
  const marqueeStart = useRef<{ x: number; y: number } | null>(null);
  const marqueeAdditive = useRef(false);
  const laserPoints = useRef<number[]>([]);
  /** Wind tool: last sample for force direction. */
  const windRef = useRef<{ x: number; y: number; t: number } | null>(null);
  /** Middle-button pan: track screen delta against view at press. */
  const middlePanRef = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null);

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target as HTMLElement).closest('input,textarea,[contenteditable]')) {
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false);
    };
    const endMiddle = () => {
      middlePanRef.current = null;
      setIsPanning(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('mouseup', endMiddle);
    window.addEventListener('blur', endMiddle);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('mouseup', endMiddle);
      window.removeEventListener('blur', endMiddle);
    };
  }, []);

  const broadcastCursor = useMemo(
    () => throttle((x: number, y: number) => conn.setPresence({ cursor: { x, y } }), AWARENESS_THROTTLE_MS),
    [conn],
  );
  const commitPen = useMemo(
    () =>
      throttle((id: string, points: number[]) => conn.updateObject(id, { points: [...points] }), PEN_COMMIT_THROTTLE_MS),
    [conn],
  );
  const broadcastLaser = useMemo(
    () =>
      throttle((points: number[]) => {
        conn.setPresence({ laser: { points: [...points], color: conn.identity.color } });
      }, AWARENESS_THROTTLE_MS),
    [conn],
  );

  const setCommentDraft = useUiStore((s) => s.setCommentDraft);

  const handleSelect = useCallback(
    (id: string, additive = false) => {
      if (tool === 'eraser') {
        conn.deleteObject(id);
        setSelectedId(null);
        return;
      }
      if (tool === 'comment') {
        const obj = objects[id];
        if (!obj) return;
        const wp =
          stageRef.current?.getRelativePointerPosition() ?? {
            x: obj.x + obj.width - 12,
            y: obj.y + 10,
          };
        setCommentDraft(makeCommentDraft(wp, obj));
        setTool('select');
        setSelectedId(null);
        return;
      }
      if (tool === 'connector' || tool === 'rope') {
        const from = connectorFromRef.current;
        if (!from) {
          connectorFromRef.current = id;
          setSelectedId(id);
          return;
        }
        if (from === id) return;
        const linkType = tool === 'rope' ? 'rope' : 'connector';
        const linkInk = strokeFromFill(fillColor);
        const connectorStyle = useUiStore.getState().connectorStyle;
        conn.addObject({
          id: nanoid(OBJECT_ID_LENGTH),
          type: linkType,
          x: 0,
          y: 0,
          width: 1,
          height: 1,
          rotation: 0,
          fill: linkInk,
          stroke: linkInk,
          strokeWidth: linkType === 'rope' ? 4 : 3,
          fromId: from,
          toId: id,
          ...(linkType === 'connector' ? { connectorStyle } : {}),
          z: conn.nextZ(),
          createdBy: conn.identity.id,
        });
        if (linkType === 'rope') {
          // Ensure both ends can participate in physics.
          conn.updateObject(from, { physics: true });
          conn.updateObject(id, { physics: true });
        }
        connectorFromRef.current = null;
        setTool('select');
        setSelectedId(id);
        return;
      }
      if (additive) toggleSelectedId(id);
      else setSelectedId(id);
    },
    [setSelectedId, toggleSelectedId, tool, conn, fillColor, setTool, objects, setCommentDraft, stageRef],
  );

  const handleCommit = useCallback(
    (id: string, patch: Partial<CanvasObject>) => conn.updateObject(id, patch),
    [conn],
  );
  const handleImpulse = useCallback(
    (id: string, vx: number, vy: number) => conn.updateObject(id, { impulse: { vx, vy, t: Date.now() } }),
    [conn],
  );

  useEffect(() => {
    const tr = transformerRef.current;
    const stage = stageRef.current;
    if (!tr || !stage) return;
    if (!interactive || editingId) {
      tr.nodes([]);
      return;
    }
    const ids = selectedIds.length ? selectedIds : selectedId ? [selectedId] : [];
    const nodes = ids
      .map((id) => {
        const obj = objects[id];
        if (!obj || obj.locked || obj.type === 'connector' || obj.type === 'rope') return null;
        return stage.findOne(`#obj-${id}`);
      })
      .filter((n): n is Konva.Node => !!n);
    tr.nodes(nodes);
  }, [selectedId, selectedIds, objects, interactive, editingId, stageRef]);

  const handleContextMenu = (e: KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault();
    if (!interactive || !onContextMenu) return;
    const world = stageRef.current?.getRelativePointerPosition();
    if (!world) return;
    let targetId: string | null = null;
    let node: Konva.Node | null = e.target;
    while (node && node !== stageRef.current) {
      const id = node.id();
      if (id.startsWith('obj-')) {
        targetId = id.slice(4);
        break;
      }
      node = node.getParent();
    }
    if (targetId) setSelectedId(targetId);
    onContextMenu({
      screen: { x: e.evt.clientX, y: e.evt.clientY },
      world,
      targetId,
    });
  };

  const zoomAt = useCallback(
    (pointer: { x: number; y: number }, factor: number) => {
      const oldScale = view.scale;
      const newScale = clamp(oldScale * factor, ZOOM_MIN, ZOOM_MAX);
      const worldX = (pointer.x - view.x) / oldScale;
      const worldY = (pointer.y - view.y) / oldScale;
      setView({ scale: newScale, x: pointer.x - worldX * newScale, y: pointer.y - worldY * newScale });
    },
    [view, setView],
  );

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const pointer = stageRef.current?.getPointerPosition();
    if (!pointer) return;
    zoomAt(pointer, e.evt.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP);
  };

  /** World under the pointer from the Stage's live transform (not a possibly-stale view store). */
  const worldPointer = (): { x: number; y: number } | null => {
    return stageRef.current?.getRelativePointerPosition() ?? null;
  };

  const createAt = (wx: number, wy: number) => {
    const id = nanoid(OBJECT_ID_LENGTH);
    const base = { id, rotation: 0, z: conn.nextZ(), createdBy: conn.identity.id };
    let obj: CanvasObject | null = null;

    const paint = shapePaintFromFill(fillColor);
    const ink = strokeFromFill(fillColor);
    if (tool === 'rect') obj = { ...base, type: 'rect', ...paint, ...centered(wx, wy, DEFAULTS.rect) };
    if (tool === 'ellipse') obj = { ...base, type: 'ellipse', ...paint, ...centered(wx, wy, DEFAULTS.ellipse) };
    if (tool === 'triangle') obj = { ...base, type: 'triangle', ...paint, ...centered(wx, wy, DEFAULTS.triangle) };
    if (tool === 'diamond') obj = { ...base, type: 'diamond', ...paint, ...centered(wx, wy, DEFAULTS.diamond) };
    if (tool === 'star') obj = { ...base, type: 'star', ...paint, ...centered(wx, wy, DEFAULTS.star) };
    if (tool === 'hexagon') obj = { ...base, type: 'hexagon', ...paint, ...centered(wx, wy, DEFAULTS.hexagon) };
    if (tool === 'line') {
      obj = {
        ...base,
        type: 'line',
        fill: ink,
        stroke: ink,
        strokeWidth: 2,
        ...centered(wx, wy, DEFAULTS.line),
      };
    }
    if (tool === 'arrow') {
      obj = {
        ...base,
        type: 'arrow',
        fill: ink,
        stroke: ink,
        strokeWidth: 2,
        ...centered(wx, wy, DEFAULTS.arrow),
      };
    }
    if (tool === 'elbowArrow') {
      obj = {
        ...base,
        type: 'elbowArrow',
        fill: ink,
        stroke: ink,
        strokeWidth: 2,
        ...centered(wx, wy, DEFAULTS.elbowArrow),
      };
    }
    if (tool === 'blockArrow') {
      obj = {
        ...base,
        type: 'blockArrow',
        fill: ink,
        stroke: ink,
        strokeWidth: 2,
        ...centered(wx, wy, DEFAULTS.blockArrow),
      };
    }
    if (tool === 'divider') {
      obj = {
        ...base,
        type: 'divider',
        fill: ink,
        stroke: ink,
        strokeWidth: 2,
        ...centered(wx, wy, DEFAULTS.divider),
      };
    }
    if (tool === 'sticky') {
      const fill = STICKY_COLORS[Math.floor(Math.random() * STICKY_COLORS.length)];
      obj = { ...base, type: 'sticky', fill, text: '', ...centered(wx, wy, DEFAULTS.sticky) };
    }
    if (tool === 'text') {
      obj = {
        ...base,
        type: 'text',
        fill: '#e9ecef',
        text: '',
        fontSize: DEFAULT_FONT_SIZE,
        ...centered(wx, wy, DEFAULTS.text),
      };
    }
    if (tool === 'code') {
      obj = createCodeObject({
        id,
        centerX: wx,
        centerY: wy,
        z: base.z,
        createdBy: base.createdBy,
      });
    }
    if (tool === 'frame') {
      obj = {
        ...base,
        type: 'frame',
        fill: 'rgba(61,139,253,0.08)',
        stroke: SELECTION_STROKE,
        strokeWidth: 2,
        text: 'Frame',
        ...centered(wx, wy, DEFAULTS.frame),
      };
    }
    if (tool === 'table') {
      obj = {
        ...base,
        type: 'table',
        fill: '#161B22',
        stroke: SELECTION_STROKE,
        strokeWidth: 1,
        cells: DEFAULT_TABLE_CELLS,
        dataView: 'table',
        records: [
          { id: nanoid(8), title: 'First task', status: 'To do', priority: 'Medium' },
          { id: nanoid(8), title: 'Second task', status: 'In progress', priority: 'High' },
        ],
        ...centered(wx, wy, DEFAULTS.table),
      };
    }
    if (tool === 'mindmap') {
      obj = createMindMapRoot(conn, { x: wx, y: wy });
    }
    if (tool === 'stamp') {
      if (stampGifSrc) {
        const size = 168;
        obj = {
          ...base,
          type: 'image',
          fill: 'transparent',
          src: stampGifSrc,
          ...centered(wx, wy, { width: size, height: size }),
        };
      } else {
        obj = {
          ...base,
          type: 'stamp',
          fill: ink,
          text: stampGlyph,
          ...centered(wx, wy, DEFAULTS.stamp),
        };
      }
    }
    if (tool === 'magnet') {
      const magnetId = placeMagnet(conn, { x: wx, y: wy });
      setTool('select');
      setSelectedId(magnetId);
      return;
    }
    if (tool === 'archiveWell') {
      const wellId = placeArchiveWell(conn, { x: wx, y: wy });
      setTool('select');
      setSelectedId(wellId);
      return;
    }
    if (!obj) return;

    conn.addObject(obj);
    setTool('select');
    setSelectedId(id);
    if (
      obj.type === 'text' ||
      obj.type === 'sticky' ||
      obj.type === 'frame' ||
      obj.type === 'code' ||
      obj.mindMapId
    ) {
      onEditText(id);
    }
  };

  const handlePointerDown = (e: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (!interactive) return;
    const native = e.evt as MouseEvent;
    if (native.button === 1) {
      e.evt.preventDefault();
      middlePanRef.current = { sx: native.clientX, sy: native.clientY, vx: view.x, vy: view.y };
      setIsPanning(true);
      return;
    }
    if (spaceDown || tool === 'hand') return;
    // Konva bubbles: only the Stage itself counts as empty canvas (not object hits).
    const onEmpty = e.target === stageRef.current;
    const wp = worldPointer();
    if (!wp) return;

    if (tool === 'select' && onEmpty) {
      const additive = !!(native.shiftKey || native.ctrlKey || native.metaKey);
      marqueeAdditive.current = additive;
      marqueeStart.current = wp;
      setMarquee({ x: wp.x, y: wp.y, w: 0, h: 0 });
      if (!additive) setSelectedIds([]);
      return;
    }
    if (tool === 'laser') {
      laserPoints.current = [wp.x, wp.y];
      broadcastLaser(laserPoints.current);
      return;
    }
    if (tool === 'pen' || tool === 'highlighter') {
      const id = nanoid(OBJECT_ID_LENGTH);
      const highlight = tool === 'highlighter';
      penRef.current = { id, x: wp.x, y: wp.y, points: [0, 0] };
      conn.addObject({
        id,
        type: 'path',
        x: wp.x,
        y: wp.y,
        width: 1,
        height: 1,
        rotation: 0,
        fill: 'transparent',
        stroke: strokeFromFill(fillColor),
        strokeWidth: highlight ? HIGHLIGHTER_STROKE : PEN_STROKE_WIDTH,
        opacity: highlight ? HIGHLIGHTER_OPACITY : 1,
        points: [0, 0],
        z: conn.nextZ(),
        createdBy: conn.identity.id,
      });
      return;
    }
    if (tool === 'attract' || tool === 'repel') {
      conn.setPresence({ attract: { x: wp.x, y: wp.y, dir: tool === 'attract' ? 1 : -1 } });
      return;
    }
    if (tool === 'wind') {
      windRef.current = { x: wp.x, y: wp.y, t: performance.now() };
      conn.setPresence({ wind: { x: wp.x, y: wp.y, vx: 0, vy: 0 } });
      return;
    }
    if (tool === 'comment' && onEmpty) {
      setCommentDraft(makeCommentDraft(wp));
      setTool('select');
      return;
    }
    if (onEmpty) createAt(wp.x, wp.y);
  };

  const handlePointerMove = (e?: KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (middlePanRef.current && e) {
      const native = e.evt as MouseEvent;
      if (typeof native.clientX === 'number') {
        const { sx, sy, vx, vy } = middlePanRef.current;
        const next = { x: vx + (native.clientX - sx), y: vy + (native.clientY - sy) };
        setView(next);
        // Stage props update next frame — compute world from the pending camera.
        const p = stageRef.current?.getPointerPosition();
        const scale = useViewStore.getState().scale;
        if (p && scale) broadcastCursor((p.x - next.x) / scale, (p.y - next.y) / scale);
      }
      return;
    }
    const wp = worldPointer();
    if (!wp) return;
    broadcastCursor(wp.x, wp.y);
    if (!interactive) return;

    if (marqueeStart.current) {
      const s = marqueeStart.current;
      setMarquee({
        x: Math.min(s.x, wp.x),
        y: Math.min(s.y, wp.y),
        w: Math.abs(wp.x - s.x),
        h: Math.abs(wp.y - s.y),
      });
    }
    if (tool === 'laser' && laserPoints.current.length) {
      laserPoints.current.push(wp.x, wp.y);
      if (laserPoints.current.length > 80) laserPoints.current = laserPoints.current.slice(-80);
      broadcastLaser(laserPoints.current);
    }
    if (penRef.current) {
      const pen = penRef.current;
      pen.points.push(wp.x - pen.x, wp.y - pen.y);
      commitPen(pen.id, pen.points);
    }
    const attract = (conn.awareness.getLocalState() as { attract?: unknown } | null)?.attract;
    if ((tool === 'attract' || tool === 'repel') && attract) {
      conn.setPresence({ attract: { x: wp.x, y: wp.y, dir: tool === 'attract' ? 1 : -1 } });
    }
    if (tool === 'wind' && windRef.current) {
      const prev = windRef.current;
      const now = performance.now();
      const dt = Math.max(16, now - prev.t) / 1000;
      const vx = (wp.x - prev.x) / dt;
      const vy = (wp.y - prev.y) / dt;
      windRef.current = { x: wp.x, y: wp.y, t: now };
      conn.setPresence({ wind: { x: wp.x, y: wp.y, vx, vy } });
    }
  };

  const finishMarquee = () => {
    if (!marquee || !marqueeStart.current) {
      marqueeStart.current = null;
      setMarquee(null);
      return;
    }
    const box = marquee;
    const hits = Object.values(objects)
      .filter((o) => o.type !== 'connector' && o.type !== 'rope')
      .filter((o) => intersects(box, o))
      .map((o) => o.id);
    if (marqueeAdditive.current) addSelectedIds(hits);
    else setSelectedIds(hits);
    marqueeAdditive.current = false;
    marqueeStart.current = null;
    setMarquee(null);
  };

  const handlePointerUp = () => {
    middlePanRef.current = null;
    setIsPanning(false);
    if (marqueeStart.current) finishMarquee();
    if (penRef.current) {
      finishPenStroke(conn, penRef.current);
      penRef.current = null;
    }
    if (laserPoints.current.length) {
      laserPoints.current = [];
      conn.setPresence({ laser: null });
    }
    conn.setPresence({ attract: null, wind: null });
    windRef.current = null;
  };

  const handleStageDrag = (e: KonvaEventObject<DragEvent>) => {
    if (e.target !== stageRef.current) return;
    setView({ x: e.target.x(), y: e.target.y() });
    // Screen pointer stays put while the camera moves — rebroadcast world under it.
    const wp = stageRef.current.getRelativePointerPosition();
    if (wp) broadcastCursor(wp.x, wp.y);
  };

  const handleTouchMove = (e: KonvaEventObject<TouchEvent>) => {
    const touches = e.evt.touches;
    if (touches.length !== 2) return;
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;
    const dist = Math.hypot(touches[0].clientX - touches[1].clientX, touches[0].clientY - touches[1].clientY);
    // zoomAt expects stage/container coords (same space as getPointerPosition), not clientX/Y.
    const rect = stage.container().getBoundingClientRect();
    const center = {
      x: (touches[0].clientX + touches[1].clientX) / 2 - rect.left,
      y: (touches[0].clientY + touches[1].clientY) / 2 - rect.top,
    };
    if (pinchRef.current) zoomAt(center, dist / pinchRef.current.dist);
    pinchRef.current = { dist };
  };

  const sorted = useMemo(
    () => Object.values(objects).sort((a, b) => a.z - b.z || a.id.localeCompare(b.id)),
    [objects],
  );

  // Space or Hand tool pans via Konva drag; middle-mouse pans via pointer deltas.
  const stageDraggable = interactive && (spaceDown || tool === 'hand');

  return (
    <Stage
      ref={stageRef as React.Ref<Konva.Stage>}
      width={size.w}
      height={size.h}
      x={view.x}
      y={view.y}
      scaleX={view.scale}
      scaleY={view.scale}
      // Only enable stage drag for pan tools; object drags must not pan (check target === stage if expanding).
      draggable={stageDraggable}
      onDragMove={handleStageDrag}
      onDragEnd={handleStageDrag}
      onWheel={handleWheel}
      onMouseDown={handlePointerDown}
      onTouchStart={handlePointerDown}
      onMouseMove={handlePointerMove}
      onTouchMove={(e) => {
        handleTouchMove(e);
        handlePointerMove(e);
      }}
      onMouseUp={handlePointerUp}
      onTouchEnd={() => {
        pinchRef.current = null;
        handlePointerUp();
      }}
      onMouseLeave={() => {
        handlePointerUp();
        conn.setPresence({ cursor: null });
      }}
      onContextMenu={handleContextMenu}
      style={{
        cursor:
          spaceDown || isPanning || tool === 'hand'
            ? spaceDown || isPanning
              ? 'grabbing'
              : 'grab'
            : tool === 'select'
              ? 'default'
              : 'crosshair',
        background: stageBg,
      }}
    >
      <GridLayer width={size.w} height={size.h} />
      <Layer name="objects">
        <ConnectorLayer
          objects={objects}
          interactive={
            interactive &&
            (tool === 'select' || tool === 'eraser' || tool === 'connector' || tool === 'rope' || tool === 'comment')
          }
          onSelect={(id, additive) => handleSelect(id, additive)}
        />
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
              selected={selectedIds.includes(obj.id) || selectedId === obj.id}
              interactive={
                interactive &&
                (tool === 'select' ||
                  tool === 'eraser' ||
                  tool === 'connector' ||
                  tool === 'rope' ||
                  tool === 'comment')
              }
              onSelect={(id, additive) => handleSelect(id, additive)}
              onCommit={handleCommit}
              onImpulse={handleImpulse}
              onEditText={onEditText}
              onDiagramAction={onDiagramAction}
            />
          ))}
        {marquee && (
          <Rect
            x={marquee.x}
            y={marquee.y}
            width={marquee.w}
            height={marquee.h}
            fill="rgba(61,139,253,0.12)"
            stroke={SELECTION_STROKE}
            strokeWidth={1}
            dash={[6, 4]}
            listening={false}
          />
        )}
      </Layer>
      <Layer name="overlay">
        <CursorsOverlay users={remoteUsers} />
        <Transformer
          ref={transformerRef}
          rotateEnabled={selectedIds.length <= 1}
          flipEnabled={false}
          anchorSize={9}
          anchorCornerRadius={4}
          borderStroke={SELECTION_STROKE}
          borderDash={[6, 4]}
          anchorStroke={SELECTION_STROKE}
          anchorFill="#fff"
          // Overlay layer — keep chrome above every board object (strokes, frames, etc.).
          listening={interactive}
        />
      </Layer>
    </Stage>
  );
}

function centered(wx: number, wy: number, d: { width: number; height: number }) {
  return { x: wx - d.width / 2, y: wy - d.height / 2, width: d.width, height: d.height };
}

function intersects(
  box: { x: number; y: number; w: number; h: number },
  o: CanvasObject,
): boolean {
  return !(o.x > box.x + box.w || o.x + o.width < box.x || o.y > box.y + box.h || o.y + o.height < box.y);
}

function finishPenStroke(conn: RoomConnection, pen: { id: string; x: number; y: number; points: number[] }) {
  const xs = pen.points.filter((_, i) => i % 2 === 0);
  const ys = pen.points.filter((_, i) => i % 2 === 1);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const width = Math.max(1, Math.max(...xs) - minX);
  const height = Math.max(1, Math.max(...ys) - minY);
  conn.updateObject(pen.id, {
    x: pen.x + minX,
    y: pen.y + minY,
    width,
    height,
    points: pen.points.map((p, i) => (i % 2 === 0 ? p - minX : p - minY)),
  });
}
