import { nanoid } from 'nanoid';
import { z } from 'zod';
import { DEFAULTS, OBJECT_ID_LENGTH } from '../../shared/constants/canvas.constants';
import { GRAVITY } from '../../shared/constants/colors.constants';
import {
  BOARD_FILE_ALLOWED_MIME,
  BOARD_FILE_MAX_BYTES,
  VIDEO_MAX_BYTES,
} from '../../shared/constants/media.constants';
import type { CanvasObject } from '../../shared/types';
import { dialogAlert } from '../../shared/components/DialogHost';
import { sniffFileBytes, sniffMatchesDeclared } from '../../shared/utils/file-sniff';
import { persistDataUrl } from './persist-media';

const videoFileMetaSchema = z.object({
  size: z.number().int().positive().max(VIDEO_MAX_BYTES),
  type: z
    .string()
    .refine((m) => m.startsWith('video/'), { message: 'Choose an MP4 or WebM video.' }),
});

const boardFileMetaSchema = z.object({
  size: z.number().int().positive().max(BOARD_FILE_MAX_BYTES),
  name: z.string().min(1),
  type: z.string(),
});

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

function probeVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const d = Number.isFinite(video.duration) ? video.duration : 0;
      URL.revokeObjectURL(url);
      resolve(d);
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    video.src = url;
  });
}

function mimeOf(file: File): string {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith('.pdf')) return 'application/pdf';
  if (name.endsWith('.md')) return 'text/markdown';
  if (name.endsWith('.json')) return 'application/json';
  if (name.endsWith('.txt')) return 'text/plain';
  if (name.endsWith('.mp4')) return 'video/mp4';
  if (name.endsWith('.webm')) return 'video/webm';
  if (name.endsWith('.mov')) return 'video/quicktime';
  return 'application/octet-stream';
}

/**
 * Build a board video object after size/MIME checks.
 * Prefers durable `/api/v1/media/...` over inline data URLs.
 */
export async function fileToVideoObject(
  file: File,
  center: { x: number; y: number },
  z: number,
  createdBy: string,
): Promise<CanvasObject | null> {
  const mime = mimeOf(file);
  const meta = videoFileMetaSchema.safeParse({ size: file.size, type: mime });
  if (!meta.success) {
    const msg = meta.error.issues[0]?.message;
    if (msg?.includes('video')) {
      await dialogAlert('Choose an MP4 or WebM video.', 'Video');
    } else {
      await dialogAlert(
        `Videos must be under ${Math.round(VIDEO_MAX_BYTES / (1024 * 1024))} MB so the room stays fast to sync.`,
        'Video too large',
      );
    }
    return null;
  }

  const head = new Uint8Array(await file.slice(0, 4100).arrayBuffer());
  const sniff = await sniffFileBytes(head, mime, file.name);
  if (!sniffMatchesDeclared(sniff, mime, file.name)) {
    await dialogAlert('That file did not look like a valid video. Try MP4 or WebM.', 'Video');
    return null;
  }

  const seconds = await probeVideoDuration(file);
  const dataUrl = await readAsDataUrl(file);
  const src = await persistDataUrl(dataUrl, mime);
  const { width, height } = DEFAULTS.video;
  return {
    id: nanoid(OBJECT_ID_LENGTH),
    type: 'video',
    x: center.x - width / 2,
    y: center.y - height / 2,
    width,
    height,
    rotation: 0,
    fill: GRAVITY.ink,
    stroke: '#3d4454',
    strokeWidth: 1.5,
    src,
    mimeType: mime,
    fileName: file.name,
    audioDuration: seconds || undefined,
    text: file.name,
    z,
    createdBy,
  };
}

/**
 * Build a board file card (PDF/docs) after size/MIME checks.
 * Prefers durable `/api/v1/media/...` over inline data URLs.
 */
export async function fileToBoardFileObject(
  file: File,
  center: { x: number; y: number },
  z: number,
  createdBy: string,
): Promise<CanvasObject | null> {
  const mime = mimeOf(file);
  const meta = boardFileMetaSchema.safeParse({
    size: file.size,
    name: file.name,
    type: mime,
  });
  if (!meta.success) {
    await dialogAlert(
      `Files must be under ${Math.round(BOARD_FILE_MAX_BYTES / (1024 * 1024))} MB so offline sync stays reliable.`,
      'File too large',
    );
    return null;
  }

  const allowed =
    BOARD_FILE_ALLOWED_MIME.has(mime) || /\.(pdf|txt|md|json|doc|docx)$/i.test(file.name);
  if (!allowed) {
    await dialogAlert('Supported files: PDF, TXT, MD, JSON, DOC, DOCX.', 'File');
    return null;
  }

  const head = new Uint8Array(await file.slice(0, 4100).arrayBuffer());
  const sniff = await sniffFileBytes(head, mime, file.name);
  if (!sniffMatchesDeclared(sniff, mime, file.name)) {
    await dialogAlert('That file failed a security check. Try another file type.', 'File');
    return null;
  }

  const dataUrl = await readAsDataUrl(file);
  const src = await persistDataUrl(dataUrl, mime);
  const { width, height } = DEFAULTS.file;
  return {
    id: nanoid(OBJECT_ID_LENGTH),
    type: 'file',
    x: center.x - width / 2,
    y: center.y - height / 2,
    width,
    height,
    rotation: 0,
    fill: '#1c1f28',
    stroke: '#5b6478',
    strokeWidth: 1.5,
    src,
    mimeType: mime,
    fileName: file.name,
    text: file.name,
    z,
    createdBy,
  };
}
