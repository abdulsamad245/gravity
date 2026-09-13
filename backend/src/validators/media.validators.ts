import { z } from 'zod';
import { MEDIA_MAX_BYTES } from '../constants/media.constants';

/** Base64 data URLs expand ~33%; allow headroom under the Express JSON limit. */
const MAX_DATA_URL_CHARS = Math.ceil(MEDIA_MAX_BYTES * 1.4) + 64;

export const mediaUploadBodySchema = z.object({
  dataUrl: z.string().min(32).max(MAX_DATA_URL_CHARS),
  mimeType: z.string().max(120).optional(),
});

export type MediaUploadBody = z.infer<typeof mediaUploadBodySchema>;

export const mediaIdParamsSchema = z.object({
  id: z
    .string()
    .regex(/^[a-f0-9]{16,64}\.[a-z0-9]{2,8}$/i, 'Invalid media id'),
});
