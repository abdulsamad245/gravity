import {
  isOrbitAudioType,
  isOrbitVideoFile,
  ORBIT_ALLOWED_EXT,
  ORBIT_ALLOWED_MIME,
  ORBIT_MAX_ATTACHMENTS,
  ORBIT_MAX_EXTRACT_CHARS,
  ORBIT_MAX_FILE_BYTES,
  ORBIT_MAX_TOTAL_EXTRACT_CHARS,
} from '../../shared/constants/media.constants';
import { sniffFileBytes, sniffMatchesDeclared } from '../../shared/utils/file-sniff';

export interface OrbitAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  /** Preview only (images / audio). Described or transcribed before chat; never sent raw. */
  dataUrl?: string;
  /** Safe text excerpt for the model (txt/md/json/pdf). */
  extractedText?: string;
  /** Set for recorded voice notes. */
  audioDuration?: number;
}

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i).toLowerCase() : '';
}

export function isOrbitFileAllowed(file: File): boolean {
  if (isOrbitVideoFile(file.type, file.name)) return false;
  if (file.type.startsWith('audio/')) return ORBIT_ALLOWED_MIME.has(file.type) || isOrbitAudioType(file.type, file.name);
  if (ORBIT_ALLOWED_MIME.has(file.type)) return true;
  const ext = extOf(file.name);
  // Do not accept bare .webm from disk (could be video); mic notes use audio/webm MIME.
  if (ext === '.webm') return file.type.startsWith('audio/');
  return ORBIT_ALLOWED_EXT.has(ext);
}

export function formatOrbitBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export type OrbitAttachError =
  | { code: 'too_many'; message: string }
  | { code: 'too_large'; message: string }
  | { code: 'type'; message: string }
  | { code: 'read'; message: string }
  | { code: 'unsafe'; message: string };

function sanitizeExtracted(text: string, max: number): string {
  return text
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Best-effort printable strings from PDF bytes (no external PDF parser). */
function extractPdfTextRough(buf: ArrayBuffer, max: number): string {
  const bytes = new Uint8Array(buf);
  const limit = Math.min(bytes.length, 400_000);
  let raw = '';
  for (let i = 0; i < limit; i++) {
    const c = bytes[i]!;
    raw += c >= 32 && c < 127 ? String.fromCharCode(c) : ' ';
  }
  const paren = [...raw.matchAll(/\((?:\\.|[^\\)]){2,120}\)/g)].map((m) =>
    m[0]
      .slice(1, -1)
      .replace(/\\([nrt\\()])/g, (_, ch: string) => {
        if (ch === 'n') return ' ';
        if (ch === 'r' || ch === 't') return ' ';
        return ch;
      }),
  );
  const joined = (paren.length ? paren.join(' ') : raw).replace(/\s+/g, ' ').trim();
  return sanitizeExtracted(joined, max);
}

async function extractTextForModel(file: File, bytes: ArrayBuffer): Promise<string | undefined> {
  const ext = extOf(file.name);
  const mime = file.type;
  const max = ORBIT_MAX_EXTRACT_CHARS;

  if (
    mime.startsWith('text/') ||
    mime === 'application/json' ||
    ext === '.txt' ||
    ext === '.md' ||
    ext === '.json'
  ) {
    const text = await file.text();
    const cleaned = sanitizeExtracted(text, max);
    return cleaned || undefined;
  }

  if (mime === 'application/pdf' || ext === '.pdf') {
    const cleaned = extractPdfTextRough(bytes, max);
    return cleaned.length >= 12 ? cleaned : undefined;
  }

  return undefined;
}

/** Validate and load files for the Orbit composer. */
export async function prepareOrbitAttachments(
  files: FileList | File[],
  already: number,
  /** Extracted text already queued in the composer (chars). */
  alreadyExtractedChars = 0,
): Promise<{ ok: OrbitAttachment[]; errors: OrbitAttachError[] }> {
  const list = Array.from(files);
  const errors: OrbitAttachError[] = [];
  const ok: OrbitAttachment[] = [];
  const room = ORBIT_MAX_ATTACHMENTS - already;
  let extractBudget = Math.max(0, ORBIT_MAX_TOTAL_EXTRACT_CHARS - alreadyExtractedChars);

  if (room <= 0) {
    errors.push({
      code: 'too_many',
      message: `You can attach up to ${ORBIT_MAX_ATTACHMENTS} files.`,
    });
    return { ok, errors };
  }

  for (const file of list.slice(0, room)) {
    if (isOrbitVideoFile(file.type, file.name)) {
      errors.push({
        code: 'type',
        message: `"${file.name}" is a video. Orbit chat accepts images, voice notes, PDF, TXT, MD, or JSON (max ${formatOrbitBytes(ORBIT_MAX_FILE_BYTES)} each).`,
      });
      continue;
    }
    if (!isOrbitFileAllowed(file)) {
      errors.push({
        code: 'type',
        message: `"${file.name}" is not supported. Use images, voice notes, PDF, TXT, MD, or JSON (max ${formatOrbitBytes(ORBIT_MAX_FILE_BYTES)} each).`,
      });
      continue;
    }
    if (file.size <= 0) {
      errors.push({ code: 'type', message: `"${file.name}" is empty.` });
      continue;
    }
    if (file.size > ORBIT_MAX_FILE_BYTES) {
      errors.push({
        code: 'too_large',
        message: `"${file.name}" is too large (max ${formatOrbitBytes(ORBIT_MAX_FILE_BYTES)}).`,
      });
      continue;
    }
    try {
      const head = new Uint8Array(await file.slice(0, 4100).arrayBuffer());
      const sniff = await sniffFileBytes(head, file.type, file.name);
      if (!sniffMatchesDeclared(sniff, file.type, file.name)) {
        errors.push({
          code: 'unsafe',
          message: `"${file.name}" failed a security check. Try another file type.`,
        });
        continue;
      }

      const needsBytes =
        file.type === 'application/pdf' ||
        extOf(file.name) === '.pdf' ||
        file.type.startsWith('text/') ||
        file.type === 'application/json' ||
        ['.txt', '.md', '.json'].includes(extOf(file.name));
      const fullBuf = needsBytes ? await file.arrayBuffer() : head.buffer;
      let extractedText = needsBytes
        ? await extractTextForModel(file, fullBuf as ArrayBuffer)
        : undefined;
      if (extractedText) {
        if (extractBudget <= 0) {
          errors.push({
            code: 'too_large',
            message: `Attachment text is too large (max ${ORBIT_MAX_TOTAL_EXTRACT_CHARS.toLocaleString()} characters total).`,
          });
          extractedText = undefined;
        } else if (extractedText.length > extractBudget) {
          extractedText = extractedText.slice(0, extractBudget);
          extractBudget = 0;
        } else {
          extractBudget -= extractedText.length;
        }
      }

      const audio = isOrbitAudioType(file.type, file.name);
      // Preview only for images/audio — document text rides on extractedText.
      const dataUrl =
        file.type.startsWith('image/') || audio ? await readAsDataUrl(file) : undefined;

      ok.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name.replace(/[^\w.\- ()[\]]+/g, '_').slice(0, 120),
        type: file.type || (audio ? 'audio/webm' : 'application/octet-stream'),
        size: file.size,
        dataUrl,
        extractedText,
      });
    } catch {
      errors.push({ code: 'read', message: `Could not read "${file.name}".` });
    }
  }

  if (list.length > room) {
    errors.push({
      code: 'too_many',
      message: `Only ${room} more file${room === 1 ? '' : 's'} can be added (max ${ORBIT_MAX_ATTACHMENTS}).`,
    });
  }

  return { ok, errors };
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });
}
