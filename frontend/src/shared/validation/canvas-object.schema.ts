import { z } from 'zod';
import { CHART_KINDS } from '../constants/chart.constants';
import { CODE_LANGUAGES } from '../constants/code.constants';
import { CONNECTOR_STYLES } from '../constants/connector.constants';
import { OBJECT_TYPES } from '../constants/object-types';
import { validateEmbedUrl } from '../utils/validate-embed-url';

/**
 * Boundary validation for canvas objects. Internal code trusts the shared
 * TypeScript types; this schema guards the true system boundaries only:
 * imported JSON files and replayed payloads.
 */
export const canvasObjectSchema = z.object({
  id: z.string().min(1),
  type: z.enum(OBJECT_TYPES),
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
  rotation: z.number().default(0),
  fill: z.string(),
  stroke: z.string().optional(),
  strokeWidth: z.number().optional(),
  text: z.string().optional(),
  fontSize: z.number().optional(),
  fontFamily: z.string().optional(),
  fontStyle: z.string().optional(),
  textDecoration: z.string().optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  textColor: z.string().optional(),
  highlight: z.string().optional(),
  listStyle: z.enum(['none', 'bullet', 'numbered']).optional(),
  indent: z.number().int().min(0).max(6).optional(),
  href: z.string().max(2000).optional(),
  language: z.enum(CODE_LANGUAGES.map((language) => language.id)).optional(),
  opacity: z.number().min(0).max(1).optional(),
  points: z.array(z.number()).optional(),
  fromId: z.string().optional(),
  toId: z.string().optional(),
  connectorStyle: z.enum(CONNECTOR_STYLES).optional(),
  src: z.string().optional(),
  audio: z.string().optional(),
  audioDuration: z.number().optional(),
  mimeType: z.string().max(120).optional(),
  fileName: z.string().max(260).optional(),
  chartKind: z.enum(CHART_KINDS).optional(),
  chartCategories: z.array(z.string()).optional(),
  chartSeries: z
    .array(
      z.object({
        name: z.string(),
        values: z.array(z.number()),
      }),
    )
    .optional(),
  physics: z.boolean().optional(),
  locked: z.boolean().optional(),
  impulse: z.object({ vx: z.number(), vy: z.number(), t: z.number() }).nullable().optional(),
  cells: z.string().optional(),
  records: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        description: z.string().optional(),
        status: z.string(),
        start: z.string().optional(),
        end: z.string().optional(),
        priority: z.string().optional(),
      }),
    )
    .optional(),
  dataView: z.enum(['table', 'kanban', 'timeline']).optional(),
  mindMapId: z.string().optional(),
  mindMapParentId: z.string().optional(),
  mindMapCollapsed: z.boolean().optional(),
  role: z.enum(['diagram', 'magnet', 'archiveWell']).optional(),
  diagramEmpty: z.boolean().optional(),
  archived: z.boolean().optional(),
  votes: z
    .array(
      z.union([
        z.string(),
        z.object({
          id: z.string(),
          name: z.string().optional(),
          color: z.string().optional(),
          at: z.number().optional(),
        }),
      ]),
    )
    .optional(),
  z: z.number(),
  createdBy: z.string().optional(),
  privateAuthorId: z.string().optional(),
  privateRoundId: z.number().finite().optional(),
  privateRevealed: z.boolean().optional(),
}).superRefine((obj, ctx) => {
  if (obj.type !== 'embed') return;
  if (!obj.src) {
    ctx.addIssue({ code: 'custom', message: 'Embed objects need a URL', path: ['src'] });
    return;
  }
  const checked = validateEmbedUrl(obj.src);
  if (!checked.ok) {
    ctx.addIssue({ code: 'custom', message: checked.error, path: ['src'] });
  }
});

export const exportedDocumentSchema = z.object({
  app: z.string(),
  version: z.number(),
  exportedAt: z.string(),
  objects: z.array(canvasObjectSchema),
});

export type ExportedDocument = z.infer<typeof exportedDocumentSchema>;
