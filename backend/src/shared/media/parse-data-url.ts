import { ApiError } from '../../types/api-error';

export type ParsedDataUrl = {
  /** MIME without parameters (e.g. `audio/webm`, not `audio/webm;codecs=opus`). */
  mimeType: string;
  bytes: Buffer;
};

/**
 * Parse a `data:[mime][;params];base64,...` URL.
 * MediaRecorder often emits `data:audio/webm;codecs=opus;base64,...`.
 */
export function parseDataUrl(
  dataUrl: string,
  errorCode = 'INVALID_MEDIA',
  errorMessage = 'Expected a base64 data URL',
): ParsedDataUrl {
  const raw = dataUrl.trim();
  // Allow MIME parameters before `;base64,` (codecs=, charset=, etc.).
  const match = /^data:([^,]*?);base64,(.+)$/s.exec(raw);
  if (!match) {
    throw new ApiError(400, errorCode, errorMessage);
  }
  const header = match[1].trim().toLowerCase();
  const mimeType = (header.split(';')[0] || '').trim();
  if (!mimeType) {
    throw new ApiError(400, errorCode, errorMessage);
  }
  return {
    mimeType,
    bytes: Buffer.from(match[2], 'base64'),
  };
}
