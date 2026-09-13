import { z } from 'zod';

/** Max board mutations allowed in one Orbit turn. */
export const ORBIT_MAX_OPS = 48;

const orbitAddTypes = z.enum([
  'sticky',
  'text',
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

const orbitTemplateIds = z.enum([
  'brainstorm',
  'retro',
  'flowchart',
  'kanban',
  'swot',
  'impact-effort',
  'lean-coffee',
  'user-journey',
  'standup',
  'affinity',
  'sprint-board',
  'swimlane',
]);

const structuredRecordSchema = z.object({
  id: z.string().max(64).optional(),
  title: z.string().min(1).max(160),
  description: z.string().max(400).optional(),
  status: z.string().max(64).optional(),
  start: z.string().max(32).optional(),
  end: z.string().max(32).optional(),
  priority: z.string().max(40).optional(),
});

const addOpSchema = z.object({
  op: z.literal('add'),
  tempId: z.string().max(32).optional(),
  type: orbitAddTypes,
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
  width: z.number().finite().positive().max(4000).optional(),
  height: z.number().finite().positive().max(4000).optional(),
  text: z.string().max(2000).optional(),
  fill: z.string().max(64).optional(),
  stroke: z.string().max(64).optional(),
  strokeWidth: z.number().finite().min(0).max(40).optional(),
  cells: z.string().max(4000).optional(),
  records: z.array(structuredRecordSchema).max(40).optional(),
  dataView: z.enum(['table', 'kanban', 'timeline']).optional(),
  role: z.literal('diagram').optional(),
  fromTempId: z.string().max(32).optional(),
  toTempId: z.string().max(32).optional(),
  fromId: z.string().max(64).optional(),
  toId: z.string().max(64).optional(),
});

const updateOpSchema = z.object({
  op: z.literal('update'),
  id: z.string().min(1).max(64),
  patch: z
    .object({
      text: z.string().max(2000).optional(),
      x: z.number().finite().optional(),
      y: z.number().finite().optional(),
      width: z.number().finite().positive().max(4000).optional(),
      height: z.number().finite().positive().max(4000).optional(),
      fill: z.string().max(64).optional(),
      stroke: z.string().max(64).optional(),
      cells: z.string().max(4000).optional(),
      records: z.array(structuredRecordSchema).max(40).optional(),
      dataView: z.enum(['table', 'kanban', 'timeline']).optional(),
    })
    .refine((p) => Object.keys(p).length > 0, { message: 'empty patch' }),
});

const deleteOpSchema = z.object({
  op: z.literal('delete'),
  id: z.string().min(1).max(64),
});

const templateOpSchema = z.object({
  op: z.literal('template'),
  templateId: orbitTemplateIds,
});

const clusterOpSchema = z.object({
  op: z.literal('cluster'),
  groups: z
    .array(
      z.object({
        title: z.string().min(1).max(80),
        objectIds: z.array(z.string().min(1).max(64)).min(1).max(40),
      }),
    )
    .min(1)
    .max(12),
});

const summarizeOpSchema = z.object({
  op: z.literal('summarize'),
  title: z.string().max(120).optional(),
  text: z.string().min(1).max(1800),
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
});

/** Zod contract for board ops the client may apply; invalid ops are dropped, not thrown. */
export const orbitOpSchema = z.discriminatedUnion('op', [
  addOpSchema,
  updateOpSchema,
  deleteOpSchema,
  templateOpSchema,
  clusterOpSchema,
  summarizeOpSchema,
]);

/** Parsed board operation from an Orbit assistant fence. */
export type OrbitOpDto = z.infer<typeof orbitOpSchema>;

const orbitPayloadSchema = z.object({
  ops: z.array(z.unknown()).max(ORBIT_MAX_OPS),
});

const FENCE_RE = /```(?:orbit|orbit-ops|json)?\s*([\s\S]*?)```/i;

export interface ParsedOrbitAssistant {
  /** User-visible reply with the ops fence removed. */
  reply: string;
  ops: OrbitOpDto[];
}

function coerceOps(raw: unknown[]): OrbitOpDto[] {
  const out: OrbitOpDto[] = [];
  for (const item of raw) {
    const parsed = orbitOpSchema.safeParse(item);
    if (parsed.success) out.push(parsed.data);
  }
  return out.slice(0, ORBIT_MAX_OPS);
}

function tryParseOpsJson(chunk: string): OrbitOpDto[] {
  const trimmed = chunk.trim();
  if (!trimmed) return [];
  try {
    const data = JSON.parse(trimmed) as unknown;
    if (Array.isArray(data)) return coerceOps(data);
    const wrapped = orbitPayloadSchema.safeParse(data);
    if (wrapped.success) return coerceOps(wrapped.data.ops);
  } catch {
    // ignore
  }
  return [];
}

/**
 * Split an assistant message into chat text + validated board ops.
 * Ops live in a fenced ```orbit block (or a trailing JSON object with "ops").
 */
export function parseOrbitAssistantOutput(raw: string): ParsedOrbitAssistant {
  const text = raw.trim();
  if (!text) return { reply: '', ops: [] };

  let reply = text;
  let ops: OrbitOpDto[] = [];

  const fence = text.match(FENCE_RE);
  if (fence) {
    ops = tryParseOpsJson(fence[1] ?? '');
    reply = text.replace(FENCE_RE, '').trim();
  } else {
    // Fallback: whole message is JSON { message, ops } / { reply, ops }
    try {
      const data = JSON.parse(text) as {
        message?: unknown;
        reply?: unknown;
        ops?: unknown;
      };
      if (data && typeof data === 'object' && Array.isArray(data.ops)) {
        ops = coerceOps(data.ops);
        const msg =
          typeof data.message === 'string'
            ? data.message
            : typeof data.reply === 'string'
              ? data.reply
              : '';
        reply = msg.trim() || 'Done. I updated the board.';
      }
    } catch {
      // plain chat
    }
  }

  if (!reply && ops.length) {
    reply = 'Done. I updated the board.';
  }

  return { reply, ops };
}

/**
 * While streaming, hold back the trailing chars that might start an ops fence
 * so the UI does not flash the JSON block.
 */
export function visibleStreamSlice(assembled: string, alreadyEmitted: number): {
  next: string;
  emittedThrough: number;
  fencing: boolean;
} {
  const fenceAt = assembled.search(/```(?:orbit|orbit-ops|json)?/i);
  if (fenceAt >= 0) {
    const cut = Math.max(alreadyEmitted, fenceAt);
    return {
      next: assembled.slice(alreadyEmitted, cut),
      emittedThrough: assembled.length,
      fencing: true,
    };
  }

  // Hold a short tail in case ```orbit is arriving across chunks.
  const hold = 12;
  const safeEnd = Math.max(alreadyEmitted, assembled.length - hold);
  return {
    next: assembled.slice(alreadyEmitted, safeEnd),
    emittedThrough: safeEnd,
    fencing: false,
  };
}
