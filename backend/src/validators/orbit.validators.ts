import { z } from 'zod';
import {
  LLM_MAX_ATTACHMENTS,
  LLM_MAX_ATTACHMENT_BYTES,
  LLM_MAX_ATTACHMENT_TEXT,
  LLM_MAX_BOARD_ITEMS,
  LLM_MAX_CONTEXT_ITEMS,
  LLM_MAX_HISTORY_CHARS,
  LLM_MAX_HISTORY_MESSAGES,
  LLM_MAX_PROMPT_CHARS,
  LLM_MAX_TOTAL_ATTACHMENT_TEXT,
} from '../constants/llm.constants';

const contextItemSchema = z.object({
  id: z.string().max(64).optional(),
  type: z.string().max(40),
  label: z.string().max(200),
  /** Optional geometry/text so Orbit can edit selected objects. */
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
  width: z.number().finite().optional(),
  height: z.number().finite().optional(),
  text: z.string().max(500).optional(),
  fill: z.string().max(64).optional(),
});

const ORBIT_ATTACHMENT_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/json',
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/mp3',
]);

const ORBIT_VIDEO_NAME = /\.(mp4|mov|m4v|avi|mkv|webm|mpeg|mpg|ogv|3gp)$/i;

const attachmentMetaSchema = z
  .object({
    name: z.string().min(1).max(180),
    type: z.string().max(120).optional(),
    size: z.number().int().nonnegative().max(LLM_MAX_ATTACHMENT_BYTES).optional(),
    /** Sanitized document excerpt only — raw data URLs are stripped. */
    extractedText: z.string().max(LLM_MAX_ATTACHMENT_TEXT).optional(),
    dataUrl: z.string().optional(),
  })
  .superRefine((att, ctx) => {
    const type = (att.type || '').toLowerCase();
    const isVideoMime = type.startsWith('video/');
    const isVideoName = ORBIT_VIDEO_NAME.test(att.name) && !type.startsWith('audio/');
    if (isVideoMime || isVideoName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Video attachments are not allowed in Orbit chat.',
        path: ['type'],
      });
    }
  })
  .transform((att) => {
    const name = att.name.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 180);
    const type = (att.type || '').toLowerCase();
    const mimeOk = !type || ORBIT_ATTACHMENT_MIME.has(type) || type.startsWith('audio/');
    const extractedText =
      mimeOk && att.extractedText
        ? att.extractedText.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').slice(0, LLM_MAX_ATTACHMENT_TEXT)
        : undefined;
    // Drop dataUrl at the boundary so raw base64 never reaches the model.
    return {
      name: name || 'file',
      type: att.type,
      size: att.size,
      extractedText,
    };
  });

const historyMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string().max(LLM_MAX_HISTORY_CHARS),
});

/**
 * HTTP boundary for Orbit chat: prompt or attachments required;
 * total extracted attachment text is capped.
 */
export const orbitChatBodySchema = z
  .object({
    prompt: z.string().max(LLM_MAX_PROMPT_CHARS).default(''),
    app: z.string().max(40).optional(),
    context: z.array(contextItemSchema).max(LLM_MAX_CONTEXT_ITEMS).optional(),
    /** Read-only whole-board context for synthesis, clustering, and summaries. */
    board: z.array(contextItemSchema).max(LLM_MAX_BOARD_ITEMS).optional(),
    /** Objects Orbit created/updated in the last turn (for "them" / "those" follow-ups). */
    recent: z.array(contextItemSchema).max(LLM_MAX_CONTEXT_ITEMS).optional(),
    attachments: z.array(attachmentMetaSchema).max(LLM_MAX_ATTACHMENTS).optional(),
    history: z.array(historyMessageSchema).max(LLM_MAX_HISTORY_MESSAGES).optional(),
    roomId: z.string().max(64).optional(),
  })
  .superRefine((body, ctx) => {
    const hasPrompt = body.prompt.trim().length > 0;
    const hasAttachments = (body.attachments?.length ?? 0) > 0;
    if (!hasPrompt && !hasAttachments) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide a message or at least one attachment.',
        path: ['prompt'],
      });
    }

    const totalExtract = (body.attachments ?? []).reduce(
      (sum, a) => sum + (a.extractedText?.length ?? 0),
      0,
    );
    if (totalExtract > LLM_MAX_TOTAL_ATTACHMENT_TEXT) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Attachment text is too large (max ${LLM_MAX_TOTAL_ATTACHMENT_TEXT} characters total).`,
        path: ['attachments'],
      });
    }
  });

export type OrbitChatBody = z.infer<typeof orbitChatBodySchema>;

/** Base64 data URLs expand ~33%; keep under Express JSON 3mb and Orbit audio cap. */
const MAX_TRANSCRIBE_DATA_URL_CHARS = Math.ceil(LLM_MAX_ATTACHMENT_BYTES * 1.4) + 64;

export const orbitTranscribeBodySchema = z.object({
  dataUrl: z.string().min(32).max(MAX_TRANSCRIBE_DATA_URL_CHARS),
  mimeType: z.string().max(120).optional(),
});

export type OrbitTranscribeBody = z.infer<typeof orbitTranscribeBodySchema>;

/** Same payload shape as voice: base64 data URL + optional MIME. */
export const orbitDescribeBodySchema = orbitTranscribeBodySchema;
export type OrbitDescribeBody = OrbitTranscribeBody;
