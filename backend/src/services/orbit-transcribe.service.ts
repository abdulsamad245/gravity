import { config } from '../config/config';
import { LLM_MAX_ATTACHMENT_BYTES, LLM_MAX_ATTACHMENT_TEXT } from '../constants/llm.constants';
import { parseDataUrl } from '../shared/media/parse-data-url';
import { ApiError } from '../types/api-error';

function extensionForMime(mime: string): string {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
  if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a';
  return 'webm';
}

/**
 * Transcribe a short Orbit voice note via the configured OpenAI-compatible
 * `/audio/transcriptions` endpoint (Whisper by default).
 */
export async function transcribeOrbitAudio(dataUrl: string, mimeHint?: string): Promise<string> {
  const key = config.LLM_API_KEY?.trim();
  if (!key) {
    throw new ApiError(503, 'LLM_UNAVAILABLE', 'Voice transcription needs LLM_API_KEY on the server.');
  }

  const parsed = parseDataUrl(dataUrl, 'INVALID_AUDIO', 'Expected a base64 audio data URL');
  const mimeType =
    mimeHint?.trim().toLowerCase().split(';')[0] ||
    (parsed.mimeType.startsWith('audio/') ? parsed.mimeType : 'audio/webm');

  if (!mimeType.startsWith('audio/') && !mimeType.includes('webm')) {
    throw new ApiError(400, 'INVALID_AUDIO', 'Only audio voice notes can be transcribed.');
  }
  if (parsed.bytes.length === 0) {
    throw new ApiError(400, 'INVALID_AUDIO', 'Voice note is empty.');
  }
  if (parsed.bytes.length > LLM_MAX_ATTACHMENT_BYTES) {
    throw new ApiError(400, 'AUDIO_TOO_LARGE', 'Voice note is too large to transcribe.');
  }

  const form = new FormData();
  const file = new Blob([new Uint8Array(parsed.bytes)], { type: mimeType });
  form.append('file', file, `voice-note.${extensionForMime(mimeType)}`);
  form.append('model', config.LLM_TRANSCRIBE_MODEL);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.LLM_TIMEOUT_MS);

  try {
    const res = await fetch(`${config.LLM_BASE_URL.replace(/\/$/, '')}/audio/transcriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      signal: controller.signal,
    });

    if (res.status === 429) {
      throw new ApiError(429, 'LLM_RATE_LIMITED', 'Transcription is busy. Try again shortly.');
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new ApiError(502, 'LLM_UPSTREAM_ERROR', 'Could not transcribe that voice note.', {
        status: res.status,
        detail: detail.slice(0, 200),
      });
    }

    const data = (await res.json()) as { text?: string };
    const text = (data.text ?? '')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .trim()
      .slice(0, LLM_MAX_ATTACHMENT_TEXT);

    if (!text) {
      throw new ApiError(422, 'EMPTY_TRANSCRIPT', 'I could not hear words in that voice note. Try again.');
    }
    return text;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError(504, 'LLM_TIMEOUT', 'Transcription took too long. Try a shorter note.');
    }
    throw new ApiError(502, 'LLM_UPSTREAM_ERROR', 'Could not transcribe that voice note.');
  } finally {
    clearTimeout(timer);
  }
}
