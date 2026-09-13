import { uploadMedia } from '../../shared/api/client';
import { logger } from '../../shared/logging/logger';

/**
 * Prefer durable media URLs. Falls back to the original data URL when upload
 * fails so local/offline creation still works. On reconnect,
 * `promoteInlineMedia` uploads those data URLs to the server.
 */
export async function persistDataUrl(dataUrl: string, mimeType?: string): Promise<string> {
  try {
    const stored = await uploadMedia(dataUrl, mimeType);
    return stored.url;
  } catch (error) {
    logger.warn('Media upload failed; keeping inline data URL', error);
    return dataUrl;
  }
}
