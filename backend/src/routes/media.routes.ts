import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { MEDIA_RATE_LIMIT } from '../constants/media.constants';
import { getMedia, postMedia } from '../controllers/media.controller';
import { validateBody, validateParams } from '../middleware/validate.middleware';
import { mediaIdParamsSchema, mediaUploadBodySchema } from '../validators/media.validators';

export const mediaRouter = Router();

const mediaLimiter = rateLimit({
  ...MEDIA_RATE_LIMIT,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many media uploads. Try again shortly.' } },
});

/**
 * @openapi
 * /api/v1/media:
 *   post:
 *     summary: Persist board media to durable storage
 *     description: >
 *       Accepts a data URL for images, audio, short video (mp4/webm/mov),
 *       PDF, and common document types. Max decoded size is 2 MB.
 *       Returns a relative `/api/v1/media/:id` URL for canvas objects.
 *     tags: [Media]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [dataUrl]
 *             properties:
 *               dataUrl: { type: string, description: data:...;base64,... payload }
 *               mimeType:
 *                 type: string
 *                 description: Optional MIME hint (image/*, audio/*, video/mp4|webm|quicktime, application/pdf, text/*)
 *     responses:
 *       201:
 *         description: Media stored
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [data, meta]
 *               properties:
 *                 data: { $ref: '#/components/schemas/MediaStoredData' }
 *                 meta: { $ref: '#/components/schemas/Meta' }
 *       400:
 *         description: Invalid body or unsupported MIME / oversize
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 *       429:
 *         description: Rate limited
 * /api/v1/media/{id}:
 *   get:
 *     summary: Fetch durable media bytes
 *     tags: [Media]
 *     parameters:
 *       - $ref: '#/components/parameters/MediaId'
 *     responses:
 *       200:
 *         description: Raw media bytes (Content-Type set from stored MIME)
 *         content:
 *           application/octet-stream:
 *             schema: { type: string, format: binary }
 *       404:
 *         description: Missing media
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
mediaRouter.post('/media', mediaLimiter, validateBody(mediaUploadBodySchema), postMedia);
mediaRouter.get('/media/:id', validateParams(mediaIdParamsSchema), getMedia);
