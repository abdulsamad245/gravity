import { API_BASE_URL, API_PREFIX } from '../constants/app.constants';

/** Mirrors the backend ReplayLogEntryDto. */
export interface ReplayLogEntry {
  t: number;
  u: string;
}

interface ApiEnvelope<T> {
  data: T;
  meta?: { requestId?: string; timestamp?: string };
}

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

interface ReplayPayload {
  room: string;
  count: number;
  entries: ReplayLogEntry[];
}

export type OrbitContextItem = {
  id?: string;
  type: string;
  label: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  text?: string;
  fill?: string;
};

/** Request body for Orbit chat; mirrors backend `orbitChatBodySchema`. */
export interface OrbitChatRequest {
  prompt: string;
  app?: string;
  roomId?: string;
  context?: OrbitContextItem[];
  /** Whole-board snapshot for cluster / summarize / organize. */
  board?: OrbitContextItem[];
  /** Prior turns so Orbit understands follow-ups like "blue". */
  history?: Array<{ role: 'user' | 'assistant'; text: string }>;
  /** Objects Orbit created/updated last turn ("them" / "those"). */
  recent?: OrbitContextItem[];
  attachments?: Array<{
    name: string;
    type?: string;
    size?: number;
    /** Sanitized document excerpt for the model (never raw bytes). */
    extractedText?: string;
  }>;
}

export type OrbitStructuredRecord = {
  id?: string;
  title: string;
  description?: string;
  status?: string;
  start?: string;
  end?: string;
  priority?: string;
};

export type OrbitOp =
  | {
      op: 'add';
      tempId?: string;
      type: string;
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      text?: string;
      fill?: string;
      stroke?: string;
      strokeWidth?: number;
      cells?: string;
      records?: OrbitStructuredRecord[];
      dataView?: 'table' | 'kanban' | 'timeline';
      role?: 'diagram';
      fromTempId?: string;
      toTempId?: string;
      fromId?: string;
      toId?: string;
    }
  | {
      op: 'update';
      id: string;
      patch: {
        text?: string;
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        fill?: string;
        stroke?: string;
        cells?: string;
        records?: OrbitStructuredRecord[];
        dataView?: 'table' | 'kanban' | 'timeline';
      };
    }
  | { op: 'delete'; id: string }
  | { op: 'template'; templateId: string }
  | {
      op: 'cluster';
      groups: Array<{ title: string; objectIds: string[] }>;
    }
  | {
      op: 'summarize';
      title?: string;
      text: string;
      x?: number;
      y?: number;
    };

export interface OrbitChatResponse {
  reply: string;
  provider: string;
  model?: string;
  ops?: OrbitOp[];
}

export interface InviteRequest {
  emails: string[];
  roomId: string;
  roomTitle: string;
  roomUrl: string;
  inviterName?: string;
  /** Optional Live call link (Meet / Zoom / Discord / Teams / …) included in the invite email. */
  callUrl?: string;
}

export interface InviteResponse {
  ok: true;
  accepted: number;
  mode: 'queued' | 'deferred';
}

/** Clients must unwrap body.data (API envelope). */
async function parseEnvelope<T>(res: Response): Promise<T> {
  const body = (await res.json()) as ApiEnvelope<T> & ApiErrorBody;
  if (!res.ok) {
    throw new Error(body.error?.message || `Request failed: ${res.status}`);
  }
  return body.data;
}

/** Fetch recorded Yjs updates for session replay (unwraps the API envelope). */
export async function fetchReplayLog(roomId: string): Promise<ReplayLogEntry[]> {
  const res = await fetch(`${API_BASE_URL}${API_PREFIX}/replay/${roomId}`);
  const data = await parseEnvelope<ReplayPayload>(res);
  return data.entries;
}

/** True when the server already has this room (live or persisted). */
export async function roomExists(roomId: string): Promise<boolean> {
  const res = await fetch(`${API_BASE_URL}${API_PREFIX}/rooms/${encodeURIComponent(roomId)}/exists`);
  const data = await parseEnvelope<{ room: string; exists: boolean }>(res);
  return data.exists;
}

/** Ask Orbit via the Gravity backend (API key never leaves the server). */
export async function askOrbit(
  payload: OrbitChatRequest,
  signal?: AbortSignal,
): Promise<OrbitChatResponse> {
  const res = await fetch(`${API_BASE_URL}${API_PREFIX}/orbit/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });
  return parseEnvelope<OrbitChatResponse>(res);
}

/** Transcribe an Orbit voice note (Whisper on the server). */
export async function transcribeOrbitAudio(
  dataUrl: string,
  mimeType?: string,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(`${API_BASE_URL}${API_PREFIX}/orbit/transcribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataUrl, mimeType }),
    signal,
  });
  const data = await parseEnvelope<{ text: string }>(res);
  return data.text.trim();
}

/** Describe an Orbit image attachment (vision on the server). */
export async function describeOrbitImage(
  dataUrl: string,
  mimeType?: string,
  signal?: AbortSignal,
): Promise<string> {
  const res = await fetch(`${API_BASE_URL}${API_PREFIX}/orbit/describe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataUrl, mimeType }),
    signal,
  });
  const data = await parseEnvelope<{ text: string }>(res);
  return data.text.trim();
}

export type OrbitStreamEvent =
  | { type: 'status'; status: 'thinking' }
  | { type: 'delta'; text: string }
  | { type: 'done'; provider: string; model?: string; reply?: string; ops?: OrbitOp[] }
  | { type: 'error'; message: string; provider: string };

/** Stream Orbit reply tokens (SSE). Falls back to non-stream askOrbit on hard failures. */
export async function askOrbitStream(
  payload: OrbitChatRequest,
  onEvent: (event: OrbitStreamEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}${API_PREFIX}/orbit/chat/stream`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
    throw new Error(body?.error?.message || `Request failed: ${res.status}`);
  }

  if (!res.body) {
    throw new Error('No stream body');
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const cancelReader = () => {
    void reader.cancel().catch(() => undefined);
  };
  signal?.addEventListener('abort', cancelReader, { once: true });

  try {
    while (true) {
      if (signal?.aborted) {
        cancelReader();
        throw new DOMException('Aborted', 'AbortError');
      }
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split('\n\n');
      buffer = chunks.pop() ?? '';

      for (const chunk of chunks) {
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (!data) continue;
          try {
            onEvent(JSON.parse(data) as OrbitStreamEvent);
          } catch {
            // Ignore malformed SSE lines.
          }
        }
      }
    }
  } finally {
    signal?.removeEventListener('abort', cancelReader);
  }
}

/** Send room invite emails (backend always returns success; delivery is logged). */
export async function sendRoomInvites(payload: InviteRequest): Promise<InviteResponse> {
  const res = await fetch(`${API_BASE_URL}${API_PREFIX}/invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return parseEnvelope<InviteResponse>(res);
}

export interface MediaUploadResponse {
  id: string;
  mimeType: string;
  bytes: number;
  url: string;
}

/** Persist a data URL to durable server storage; returns a relative `/api/v1/media/...` URL. */
export async function uploadMedia(dataUrl: string, mimeType?: string): Promise<MediaUploadResponse> {
  const res = await fetch(`${API_BASE_URL}${API_PREFIX}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ dataUrl, mimeType }),
  });
  return parseEnvelope<MediaUploadResponse>(res);
}
