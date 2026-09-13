import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config/config';
import { MEDIA_EXT_BY_MIME, MEDIA_MAX_BYTES } from '../constants/media.constants';
import { API_PREFIX } from '../constants/app.constants';
import { logger } from '../observability/logger';
import { parseDataUrl } from '../shared/media/parse-data-url';
import { ApiError } from '../types/api-error';
import { normalizeMime, resolveMediaMime } from './media/resolve-media-mime';

export interface StoredMedia {
  id: string;
  mimeType: string;
  bytes: number;
  url: string;
}

/**
 * Durable board media under DATA_DIR/media.
 * Canvas objects store the relative API URL; bytes live on disk instead of inside Yjs.
 */
export class MediaStorageService {
  private readonly mediaDir: string;

  constructor(dataDir = config.DATA_DIR) {
    this.mediaDir = path.resolve(dataDir, 'media');
  }

  async storeDataUrl(dataUrl: string, mimeHint?: string): Promise<StoredMedia> {
    const parsed = parseDataUrl(dataUrl);
    const mimeType = await resolveMediaMime(parsed.bytes, mimeHint || parsed.mimeType);
    if (!mimeType) {
      throw new ApiError(
        400,
        'UNSUPPORTED_MEDIA',
        `Unsupported or mismatched media type: ${normalizeMime(mimeHint || parsed.mimeType || 'unknown')}`,
      );
    }
    if (parsed.bytes.byteLength > MEDIA_MAX_BYTES) {
      throw new ApiError(413, 'MEDIA_TOO_LARGE', `Media exceeds ${MEDIA_MAX_BYTES} bytes`);
    }

    await mkdir(this.mediaDir, { recursive: true });
    const ext = MEDIA_EXT_BY_MIME[mimeType] ?? 'bin';
    const id = `${randomBytes(12).toString('hex')}.${ext}`;
    const destination = path.join(this.mediaDir, id);
    await writeFile(destination, parsed.bytes);
    logger.info({ id, mimeType, bytes: parsed.bytes.byteLength }, 'Media stored on disk');

    return {
      id,
      mimeType,
      bytes: parsed.bytes.byteLength,
      url: `${API_PREFIX}/media/${id}`,
    };
  }

  async read(id: string): Promise<{ bytes: Buffer; mimeType: string } | null> {
    if (!isSafeMediaId(id)) return null;
    try {
      const bytes = await readFile(path.join(this.mediaDir, id));
      const ext = path.extname(id).slice(1).toLowerCase();
      const mimeType =
        Object.entries(MEDIA_EXT_BY_MIME).find(([, value]) => value === ext)?.[0] ??
        'application/octet-stream';
      return { bytes, mimeType };
    } catch (error) {
      if (!isMissingFile(error)) {
        logger.error({ err: error, id }, 'Could not read media');
      }
    }
    return null;
  }
}

/** Reject path traversal (`../`) and unexpected filenames before disk reads. */
function isSafeMediaId(id: string): boolean {
  return /^[a-f0-9]{16,64}\.[a-z0-9]{2,8}$/i.test(id);
}

function isMissingFile(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT';
}

/** Content hash helper for tests / dedupe experiments. */
export function hashMediaBytes(bytes: Buffer): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export const mediaStorageService = new MediaStorageService();
