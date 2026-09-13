/** Yjs origin for offline→online media promotion (not undoable). */
export const TX_ORIGIN_MEDIA_PROMOTE = 'media-promote';

/** Media encode/size limits for board images and avatars. */
export const IMAGE_MAX_DIMENSION = 800;
export const IMAGE_QUALITY = 0.85;
/** Profile photos ride on awareness — keep them tiny. */
export const AVATAR_MAX_DIMENSION = 96;
export const AVATAR_QUALITY = 0.72;
export const AUDIO_MAX_SECONDS = 15;

/**
 * Board video size limit. Stay under backend MEDIA_MAX_BYTES (2 MB).
 * No duration cap.
 */
export const VIDEO_MAX_BYTES = 1.5 * 1024 * 1024; // 1.5 MB
export const VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov';

/** Generic board file cards (PDF / docs). */
export const BOARD_FILE_MAX_BYTES = 1.5 * 1024 * 1024; // 1.5 MB
export const BOARD_FILE_ACCEPT =
  'application/pdf,text/plain,text/markdown,application/json,.pdf,.txt,.md,.json,.doc,.docx';
export const BOARD_FILE_ALLOWED_MIME = new Set([
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

/**
 * Orbit composer attachments — sized for gpt-4o-mini payloads.
 * Keep in sync with backend/src/constants/llm.constants.ts (LLM_MAX_ATTACHMENT_*).
 */
export const ORBIT_MAX_ATTACHMENTS = 4;
/** Hard cap per file (bytes). */
export const ORBIT_MAX_FILE_BYTES = 1 * 1024 * 1024; // 1 MB each
/** Max characters of extracted document text per attachment. */
export const ORBIT_MAX_EXTRACT_CHARS = 8_000;
/** Cap total extracted text across all attachments in one turn. */
export const ORBIT_MAX_TOTAL_EXTRACT_CHARS = 16_000;
export const ORBIT_ACCEPT =
  'image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/markdown,application/json,audio/webm,audio/mpeg,audio/ogg,audio/wav,audio/mp4,.md,.txt,.pdf,.mp3,.m4a,.ogg,.wav';
export const ORBIT_ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/json',
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/mp3',
]);
export const ORBIT_ALLOWED_EXT = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.pdf',
  '.txt',
  '.md',
  '.json',
  '.mp3',
  '.m4a',
  '.ogg',
  '.wav',
  // Voice notes from MediaRecorder (audio/webm). Video .webm is rejected separately.
  '.webm',
]);

const ORBIT_VIDEO_EXT = new Set([
  '.mp4',
  '.mov',
  '.m4v',
  '.avi',
  '.mkv',
  '.webm',
  '.mpeg',
  '.mpg',
  '.wmv',
]);

export function isOrbitAudioType(type: string, name = ''): boolean {
  if (type.startsWith('audio/')) return true;
  const i = name.lastIndexOf('.');
  const ext = i >= 0 ? name.slice(i).toLowerCase() : '';
  return ['.webm', '.mp3', '.m4a', '.ogg', '.wav'].includes(ext) && !type.startsWith('video/');
}

/** Videos are never accepted in Orbit chat. */
export function isOrbitVideoFile(type: string, name = ''): boolean {
  if (type.startsWith('video/')) return true;
  const i = name.lastIndexOf('.');
  const ext = i >= 0 ? name.slice(i).toLowerCase() : '';
  if (!ORBIT_VIDEO_EXT.has(ext)) return false;
  // .webm / .mp4 can be audio containers — only treat as video when MIME says so
  // or when MIME is empty/unknown for classic video extensions.
  if (ext === '.webm' || ext === '.mp4' || ext === '.m4v') {
    return !type || type.startsWith('video/');
  }
  return true;
}
