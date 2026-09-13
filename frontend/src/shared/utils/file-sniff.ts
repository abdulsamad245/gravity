/**
 * Magic-byte sniff via `file-type`, plus soft fallbacks for text / some audio.
 * Product allowlists stay in callers; this only answers "what is this bytes?".
 */

export type SniffResult =
  | { kind: 'binary'; mime: string; ext?: string }
  | { kind: 'soft'; mime: string }
  | { kind: 'unknown' };

function normalizeMime(mime: string): string {
  const lower = mime.trim().toLowerCase();
  if (lower === 'image/jpg') return 'image/jpeg';
  return lower;
}

function isSoftDeclared(mime: string, name: string): boolean {
  const m = mime.toLowerCase();
  const n = name.toLowerCase();
  if (m.startsWith('text/') || m === 'application/json') return true;
  if (m.startsWith('audio/')) return true;
  if (/\.(txt|md|json)$/i.test(n)) return true;
  return false;
}

/** Sniff the first chunk of a File (or raw bytes). */
export async function sniffFileBytes(
  bytes: Uint8Array,
  declaredMime = '',
  fileName = '',
): Promise<SniffResult> {
  const { fileTypeFromBuffer } = await import('file-type');
  const detected = await fileTypeFromBuffer(bytes);
  const hint = normalizeMime(declaredMime);

  if (detected) {
    let mime = normalizeMime(detected.mime);
    if (mime === 'video/webm' && hint === 'audio/webm') mime = 'audio/webm';
    return { kind: 'binary', mime, ext: detected.ext };
  }

  if (hint && isSoftDeclared(hint, fileName)) {
    return { kind: 'soft', mime: hint };
  }
  if (!hint && isSoftDeclared('', fileName)) {
    if (fileName.toLowerCase().endsWith('.json')) return { kind: 'soft', mime: 'application/json' };
    if (fileName.toLowerCase().endsWith('.md')) return { kind: 'soft', mime: 'text/markdown' };
    if (fileName.toLowerCase().endsWith('.txt')) return { kind: 'soft', mime: 'text/plain' };
  }

  return { kind: 'unknown' };
}

/** True when sniffed content is acceptable for the declared Orbit/board type. */
export function sniffMatchesDeclared(
  sniff: SniffResult,
  declaredMime: string,
  fileName: string,
): boolean {
  const hint = normalizeMime(declaredMime);
  const soft = isSoftDeclared(hint, fileName);

  if (soft) {
    // Text/audio: reject when magic bytes look like a different binary family.
    if (sniff.kind === 'binary') {
      if (hint.startsWith('audio/') && sniff.mime.startsWith('audio/')) return true;
      if (hint === 'audio/webm' && sniff.mime === 'audio/webm') return true;
      return false;
    }
    return sniff.kind === 'soft' || sniff.kind === 'unknown';
  }

  if (sniff.kind !== 'binary') return false;
  if (!hint) return true;
  if (hint === sniff.mime) return true;
  if (hint.startsWith('image/') && sniff.mime.startsWith('image/')) return true;
  if (hint.startsWith('video/') && sniff.mime.startsWith('video/')) return true;
  if (hint.startsWith('audio/') && sniff.mime.startsWith('audio/')) return true;
  if (hint === 'application/pdf' && sniff.mime === 'application/pdf') return true;
  if (
    hint === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' &&
    (sniff.mime.includes('wordprocessingml') || sniff.mime === 'application/zip')
  ) {
    return true;
  }
  if (hint === 'application/msword' && sniff.mime === 'application/msword') return true;
  return false;
}
