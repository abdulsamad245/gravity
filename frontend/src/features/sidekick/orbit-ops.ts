import { nanoid } from 'nanoid';
import {
  DEFAULT_OUTLINE,
  DEFAULT_SHAPE_STROKE_WIDTH,
  STICKY_COLORS,
} from '../../shared/constants/colors.constants';
import { DEFAULTS, DEFAULT_TABLE_CELLS, OBJECT_ID_LENGTH } from '../../shared/constants/canvas.constants';
import {
  CODE_BACKGROUND,
  CODE_FONT_FAMILY,
  CODE_FONT_SIZE,
  CODE_TEXT,
  DEFAULT_CODE,
  DEFAULT_CODE_LANGUAGE,
  type CodeLanguage,
} from '../../shared/constants/code.constants';
import type { ObjectType } from '../../shared/constants/object-types';
import type { CanvasObject, StructuredRecord, StructuredViewMode } from '../../shared/types';
import type { RoomConnection } from '../collaboration/RoomConnection';
import { BOARD_TEMPLATES } from '../templates/templates';

const ADD_TYPES = new Set<ObjectType>([
  'sticky',
  'text',
  'code',
  'rect',
  'ellipse',
  'triangle',
  'diamond',
  'star',
  'hexagon',
  'line',
  'arrow',
  'elbowArrow',
  'blockArrow',
  'divider',
  'frame',
  'table',
  'connector',
]);

/** Client mirror of server Orbit board ops; applied via Yjs after validation. */
export type OrbitOp =
  | {
      op: 'add';
      tempId?: string;
      type: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      text?: string;
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      cells?: string;
      records?: Array<Partial<StructuredRecord> & { title: string }>;
      dataView?: StructuredViewMode;
      language?: CodeLanguage;
      role?: 'diagram';
      fromTempId?: string;
      toTempId?: string;
      fromId?: string;
      toId?: string;
    }
  | {
      op: 'update';
      id: string;
      patch: Partial<
        Pick<CanvasObject, 'text' | 'x' | 'y' | 'width' | 'height' | 'fill' | 'stroke' | 'cells' | 'dataView'>
      > & {
        records?: Array<Partial<StructuredRecord> & { title: string }>;
      };
    }
  | { op: 'delete'; id: string }
  | { op: 'template'; templateId: string }
  | { op: 'cluster'; groups: Array<{ title: string; objectIds: string[] }> }
  | { op: 'summarize'; title?: string; text: string; x?: number; y?: number };

export interface ApplyOrbitOpsResult {
  added: number;
  updated: number;
  deleted: number;
  templates: number;
  clustered: number;
  summarized: number;
  /** Real object ids created this turn (for follow-ups like "label them"). */
  createdIds: string[];
  /** Real object ids updated this turn. */
  updatedIds: string[];
}

function normalizeRecords(
  records: Array<Partial<StructuredRecord> & { title: string }> | undefined,
): StructuredRecord[] | undefined {
  if (!records?.length) return undefined;
  return records.slice(0, 40).map((record) => ({
    id: record.id && record.id.trim() ? record.id : nanoid(8),
    title: record.title.slice(0, 160),
    description: record.description?.slice(0, 400),
    status: (record.status ?? 'To do').slice(0, 64),
    start: record.start,
    end: record.end,
    priority: record.priority?.slice(0, 40),
  }));
}

function defaultSize(type: ObjectType): { width: number; height: number } {
  if (type === 'connector') return { width: 1, height: 1 };
  const d = DEFAULTS[type as keyof typeof DEFAULTS];
  if (d) return { width: d.width, height: d.height };
  return DEFAULTS.rect;
}

function defaultFill(type: ObjectType, index: number): string {
  if (type === 'sticky') return STICKY_COLORS[index % STICKY_COLORS.length];
  if (type === 'text') return '#e9ecef';
  if (type === 'code') return CODE_BACKGROUND;
  if (type === 'frame') return 'rgba(66,98,255,0.06)';
  if (type === 'connector' || type === 'line' || type === 'arrow') return DEFAULT_OUTLINE;
  if (type === 'table') return '#ffffff';
  return '#4262ff';
}

/**
 * Apply validated Orbit board ops to the live Yjs room.
 * `origin` is the world-space viewport center; add ops treat x/y as offsets from it.
 */
export function applyOrbitOps(
  conn: RoomConnection,
  ops: OrbitOp[],
  origin: { x: number; y: number },
): ApplyOrbitOpsResult {
  const result: ApplyOrbitOpsResult = {
    added: 0,
    updated: 0,
    deleted: 0,
    templates: 0,
    clustered: 0,
    summarized: 0,
    createdIds: [],
    updatedIds: [],
  };
  if (!conn.canEdit() || !ops.length) return result;

  const tempToReal = new Map<string, string>();
  let addIndex = 0;
  const connectorOps = ops.filter((op) => op.op === 'add' && op.type === 'connector');
  const otherOps = ops.filter((op) => !(op.op === 'add' && op.type === 'connector'));

  const addShape = (op: Extract<OrbitOp, { op: 'add' }>) => {
    const type = op.type as ObjectType;
    if (!ADD_TYPES.has(type) || type === 'connector') return;

    const id = nanoid(OBJECT_ID_LENGTH);
    if (op.tempId) tempToReal.set(op.tempId, id);

    const size = defaultSize(type);
    const width = op.width ?? size.width;
    const height = op.height ?? size.height;
    const x = origin.x + (op.x ?? 0) - width / 2;
    const y = origin.y + (op.y ?? 0) - height / 2;

    const obj: CanvasObject = {
      id,
      type,
      x,
      y,
      width,
      height,
      rotation: 0,
      fill: op.fill ?? defaultFill(type, addIndex),
      text: op.text,
      z: conn.nextZ(),
      createdBy: conn.identity.id,
    };

    if (op.stroke) obj.stroke = op.stroke;
    if (op.strokeWidth !== undefined) obj.strokeWidth = op.strokeWidth;
    else if (type === 'frame') {
      obj.stroke = op.stroke ?? '#4262ff';
      obj.strokeWidth = op.strokeWidth ?? 2;
    } else if (
      type === 'rect' ||
      type === 'ellipse' ||
      type === 'triangle' ||
      type === 'diamond' ||
      type === 'star' ||
      type === 'hexagon'
    ) {
      if (!op.fill) {
        obj.stroke = DEFAULT_OUTLINE;
        obj.strokeWidth = DEFAULT_SHAPE_STROKE_WIDTH;
      }
    }

    if (type === 'table') {
      const records = normalizeRecords(op.records);
      if (records) {
        obj.records = records;
        obj.dataView = op.dataView ?? 'table';
      } else {
        obj.cells = op.cells ?? DEFAULT_TABLE_CELLS;
      }
    }
    if (type === 'code') {
      obj.text = op.text ?? DEFAULT_CODE;
      obj.language = op.language ?? DEFAULT_CODE_LANGUAGE;
      obj.textColor = CODE_TEXT;
      obj.fontFamily = CODE_FONT_FAMILY;
      obj.fontSize = CODE_FONT_SIZE;
      obj.stroke = op.stroke ?? '#30363d';
      obj.strokeWidth = op.strokeWidth ?? 1;
    }

    if (op.role === 'diagram' && type === 'frame') {
      obj.role = 'diagram';
      obj.diagramEmpty = true;
    }

    conn.addObject(obj);
    result.added += 1;
    result.createdIds.push(id);
    addIndex += 1;
  };

  for (const op of otherOps) {
    if (op.op === 'template') {
      const t = BOARD_TEMPLATES.find((x) => x.id === op.templateId);
      if (!t) continue;
      for (const obj of t.build(conn.identity.id)) {
        const placed = {
          ...obj,
          x: obj.x + origin.x,
          y: obj.y + origin.y,
          z: conn.nextZ(),
        };
        conn.addObject(placed);
        result.added += 1;
        result.createdIds.push(placed.id);
      }
      result.templates += 1;
      continue;
    }

    if (op.op === 'delete') {
      if (!conn.canDeleteObject(op.id)) continue;
      conn.deleteObject(op.id);
      result.deleted += 1;
      continue;
    }

    if (op.op === 'update') {
      const existing = conn.getObject(op.id);
      if (!existing) continue;
      const patch: Partial<CanvasObject> = {};
      if (op.patch.text !== undefined) patch.text = op.patch.text;
      if (op.patch.x !== undefined) patch.x = op.patch.x;
      if (op.patch.y !== undefined) patch.y = op.patch.y;
      if (op.patch.width !== undefined) patch.width = op.patch.width;
      if (op.patch.height !== undefined) patch.height = op.patch.height;
      if (op.patch.fill !== undefined) patch.fill = op.patch.fill;
      if (op.patch.stroke !== undefined) patch.stroke = op.patch.stroke;
      if (op.patch.cells !== undefined) patch.cells = op.patch.cells;
      if (op.patch.dataView !== undefined) patch.dataView = op.patch.dataView;
      if (op.patch.records !== undefined) {
        const records = normalizeRecords(op.patch.records as Array<Partial<StructuredRecord> & { title: string }>);
        if (records) patch.records = records;
      }
      if (Object.keys(patch).length === 0) continue;
      conn.updateObject(op.id, patch);
      result.updated += 1;
      result.updatedIds.push(op.id);
      continue;
    }

    if (op.op === 'cluster') {
      for (const group of op.groups.slice(0, 12)) {
        const members = group.objectIds
          .map((id) => conn.getObject(id))
          .filter((object): object is CanvasObject => !!object);
        if (!members.length) continue;
        const pad = 36;
        const minX = Math.min(...members.map((object) => object.x)) - pad;
        const minY = Math.min(...members.map((object) => object.y)) - pad - 28;
        const maxX = Math.max(...members.map((object) => object.x + object.width)) + pad;
        const maxY = Math.max(...members.map((object) => object.y + object.height)) + pad;
        const frameId = nanoid(OBJECT_ID_LENGTH);
        conn.addObject({
          id: frameId,
          type: 'frame',
          x: minX,
          y: minY,
          width: Math.max(220, maxX - minX),
          height: Math.max(180, maxY - minY),
          rotation: 0,
          fill: 'rgba(66,98,255,0.06)',
          stroke: '#4262ff',
          strokeWidth: 2,
          text: group.title.slice(0, 80) || 'Cluster',
          z: conn.nextZ(),
          createdBy: conn.identity.id,
        });
        result.added += 1;
        result.createdIds.push(frameId);
        result.clustered += 1;
      }
      continue;
    }

    if (op.op === 'summarize') {
      const width = 280;
      const height = 200;
      const id = nanoid(OBJECT_ID_LENGTH);
      conn.addObject({
        id,
        type: 'sticky',
        x: origin.x + (op.x ?? 240) - width / 2,
        y: origin.y + (op.y ?? -40) - height / 2,
        width,
        height,
        rotation: 0,
        fill: '#fff3bf',
        text: [op.title?.trim(), op.text.trim()].filter(Boolean).join('\n\n').slice(0, 1800),
        z: conn.nextZ(),
        createdBy: conn.identity.id,
      });
      result.added += 1;
      result.summarized += 1;
      result.createdIds.push(id);
      continue;
    }

    if (op.op === 'add') addShape(op);
  }

  for (const op of connectorOps) {
    if (op.op !== 'add') continue;
    const fromId = (op.fromTempId ? tempToReal.get(op.fromTempId) : undefined) ?? op.fromId;
    const toId = (op.toTempId ? tempToReal.get(op.toTempId) : undefined) ?? op.toId;
    if (!fromId || !toId || fromId === toId) continue;
    const id = nanoid(OBJECT_ID_LENGTH);
    conn.addObject({
      id,
      type: 'connector',
      x: origin.x,
      y: origin.y,
      width: 1,
      height: 1,
      rotation: 0,
      fill: op.fill ?? DEFAULT_OUTLINE,
      stroke: op.stroke ?? DEFAULT_OUTLINE,
      strokeWidth: op.strokeWidth ?? 2,
      fromId,
      toId,
      z: conn.nextZ(),
      createdBy: conn.identity.id,
    });
    result.added += 1;
    result.createdIds.push(id);
  }

  return result;
}

export function summarizeOrbitOps(result: ApplyOrbitOpsResult): string | null {
  const bits: string[] = [];
  if (result.templates) bits.push(`${result.templates} template${result.templates === 1 ? '' : 's'}`);
  if (result.clustered) bits.push(`clustered ${result.clustered}`);
  if (result.summarized) bits.push(`summarized ${result.summarized}`);
  if (result.added) bits.push(`added ${result.added}`);
  if (result.updated) bits.push(`updated ${result.updated}`);
  if (result.deleted) bits.push(`deleted ${result.deleted}`);
  if (!bits.length) return null;
  return `Board updated: ${bits.join(', ')}.`;
}
