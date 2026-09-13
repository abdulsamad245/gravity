import { config } from '../config/config';
import { LLM_MAX_ATTACHMENT_BYTES, LLM_MAX_ATTACHMENT_TEXT, LLM_MAX_TOKENS } from '../constants/llm.constants';
import { parseDataUrl } from '../shared/media/parse-data-url';
import { ApiError } from '../types/api-error';

const IMAGE_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
]);

const DESCRIBE_PROMPT = [
  'You are helping a whiteboard assistant understand an attached image.',
  'Describe it accurately and concretely for board work:',
  '- Any readable text (OCR), labels, titles, and lists',
  '- Layout, shapes, diagram structure, and relationships',
  '- Colors, stickies, tables, charts, and notable objects',
  '- What the user likely wants if the image is a sketch, screenshot, or request',
  'Be factual. Do not invent UI that is not visible. Do not reply as a chatbot; output only the description.',
].join(' ');

function normalizeImageMime(mime: string): string {
  const m = mime.toLowerCase().split(';')[0]!.trim();
  if (m === 'image/jpg') return 'image/jpeg';
  return m;
}

/**
 * One-shot vision describe for Orbit image attachments.
 * Result is stored as extractedText so the main chat stack stays text-only.
 */
export async function describeOrbitImage(dataUrl: string, mimeHint?: string): Promise<string> {
  const key = config.LLM_API_KEY?.trim();
  if (!key) {
    throw new ApiError(503, 'LLM_UNAVAILABLE', 'Image understanding needs LLM_API_KEY on the server.');
  }

  const parsed = parseDataUrl(dataUrl, 'INVALID_IMAGE', 'Expected a base64 image data URL');
  const mimeType = normalizeImageMime(
    mimeHint?.trim() || (parsed.mimeType.startsWith('image/') ? parsed.mimeType : 'image/png'),
  );

  if (!IMAGE_MIME.has(mimeType) && !mimeType.startsWith('image/')) {
    throw new ApiError(400, 'INVALID_IMAGE', 'Only image attachments can be described.');
  }
  if (parsed.bytes.length === 0) {
    throw new ApiError(400, 'INVALID_IMAGE', 'Image is empty.');
  }
  if (parsed.bytes.length > LLM_MAX_ATTACHMENT_BYTES) {
    throw new ApiError(400, 'IMAGE_TOO_LARGE', 'Image is too large to describe.');
  }

  // Rebuild data URL with a normalized MIME so vision providers accept it.
  const visionUrl = `data:${mimeType};base64,${parsed.bytes.toString('base64')}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.LLM_TIMEOUT_MS);

  try {
    const res = await fetch(`${config.LLM_BASE_URL.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.LLM_MODEL,
        max_tokens: Math.min(900, LLM_MAX_TOKENS),
        temperature: 0.2,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: DESCRIBE_PROMPT },
              { type: 'image_url', image_url: { url: visionUrl } },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    if (res.status === 429) {
      throw new ApiError(429, 'LLM_RATE_LIMITED', 'Image understanding is busy. Try again shortly.');
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new ApiError(502, 'LLM_UPSTREAM_ERROR', 'Could not read that image.', {
        status: res.status,
        detail: detail.slice(0, 200),
      });
    }

    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = (data.choices?.[0]?.message?.content ?? '')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
      .trim()
      .slice(0, LLM_MAX_ATTACHMENT_TEXT);

    if (!text) {
      throw new ApiError(422, 'EMPTY_DESCRIPTION', 'I could not make sense of that image. Try another one.');
    }
    return text;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError(504, 'LLM_TIMEOUT', 'Reading the image took too long. Try a smaller file.');
    }
    throw new ApiError(502, 'LLM_UPSTREAM_ERROR', 'Could not read that image.');
  } finally {
    clearTimeout(timer);
  }
}
