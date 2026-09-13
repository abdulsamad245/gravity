import type { NextFunction, Request, Response } from 'express';
import { ApiResponse } from '../shared/http/api-response';
import { mediaStorageService } from '../services/media-storage.service';
import { ApiError } from '../types/api-error';
import type { MediaUploadBody } from '../validators/media.validators';

/** Persist a data-URL upload; response `data` includes the relative media URL. */
export async function postMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = req.body as MediaUploadBody;
    const stored = await mediaStorageService.storeDataUrl(body.dataUrl, body.mimeType);
    ApiResponse.created(res, stored);
  } catch (err) {
    next(err);
  }
}

/**
 * Return raw media bytes (not the JSON envelope) for `<img>` / `<audio>` / `<video>`.
 * Ids are validated in storage to block path traversal.
 */
export async function getMedia(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const id = req.params.id;
    const file = await mediaStorageService.read(id);
    if (!file) {
      next(new ApiError(404, 'NOT_FOUND', 'Media not found'));
      return;
    }
    res.setHeader('Content-Type', file.mimeType);
    // Content-addressed ids: safe to cache forever in browsers/CDNs.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.status(200).send(file.bytes);
  } catch (err) {
    next(err);
  }
}
