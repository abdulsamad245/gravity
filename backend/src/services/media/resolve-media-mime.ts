import {
  MEDIA_ALLOWED_MIME,
} from '../../constants/media.constants';

/** Declared types that often have no reliable magic number. */
const SOFT_MIME = new Set([
  'text/plain',
  'text/markdown',
  'application/json',
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
]);

export function normalizeMime(mime: string): string {
  const lower = mime.trim().toLowerCase();
  if (lower === 'image/jpg') return 'image/jpeg';
  return lower;
}

function isSoftMime(mime: string): boolean {
  return SOFT_MIME.has(mime) || mime.startsWith('text/');
}

/**
 * Prefer magic-byte detection (`file-type`). Fall back to the client hint only
 * for soft types (text / some audio) that sniffers often miss.
 */
export async function resolveMediaMime(
  bytes: Buffer,
  mimeHint?: string,
): Promise<string | null> {
  const hint = normalizeMime(mimeHint || '');
  const { fileTypeFromBuffer } = await import('file-type');
  const detected = await fileTypeFromBuffer(bytes);
  const sniffed = detected ? normalizeMime(detected.mime) : '';

  // WebM voice notes are often sniffed as video/webm; honor audio hint.
  if (sniffed === 'video/webm' && hint === 'audio/webm') {
    return MEDIA_ALLOWED_MIME.has('audio/webm') ? 'audio/webm' : null;
  }

  if (sniffed) {
    // DOCX is a zip container; some sniffers report application/zip.
    if (
      sniffed === 'application/zip' &&
      hint === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' &&
      MEDIA_ALLOWED_MIME.has(hint)
    ) {
      return hint;
    }
    if (!MEDIA_ALLOWED_MIME.has(sniffed)) return null;
    if (hint && !mimesCompatible(hint, sniffed)) return null;
    return sniffed;
  }

  if (hint && isSoftMime(hint) && MEDIA_ALLOWED_MIME.has(hint)) {
    return hint;
  }

  return null;
}

function mimesCompatible(declared: string, sniffed: string): boolean {
  if (declared === sniffed) return true;
  if (declared === 'image/jpg' && sniffed === 'image/jpeg') return true;
  if (declared.startsWith('audio/') && sniffed.startsWith('audio/')) return true;
  if (declared.startsWith('video/') && sniffed.startsWith('video/')) return true;
  if (declared.startsWith('image/') && sniffed.startsWith('image/')) return true;
  // Office Open XML is a zip container; some sniffers report application/zip.
  if (
    declared === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' &&
    (sniffed === 'application/zip' || sniffed.includes('wordprocessingml'))
  ) {
    return true;
  }
  return false;
}
