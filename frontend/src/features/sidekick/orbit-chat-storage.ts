import { nanoid } from 'nanoid';
import { OBJECT_ID_LENGTH } from '../../shared/constants/canvas.constants';
import { ORBIT_MAX_ATTACHMENTS } from '../../shared/constants/media.constants';
import { ORBIT_MAX_PROMPT_CHARS } from '../../shared/constants/orbit.constants';

/** Persisted Orbit turns (no blobs, thinking flags, or streaming state). */
export type OrbitStoredMessage = {
  role: 'user' | 'assistant';
  text: string;
  at: number;
  attachmentNames?: string[];
};

export type OrbitChatSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: OrbitStoredMessage[];
};

export type OrbitChatStore = {
  version: 1;
  activeId: string | null;
  sessions: OrbitChatSession[];
};

const STORE_VERSION = 1 as const;
const MAX_SESSIONS = 20;
const MAX_MESSAGES = 80;
/** Persist at most one prompt-sized turn (matches API / composer cap). */
const MAX_TEXT = ORBIT_MAX_PROMPT_CHARS;

function storageKey(roomId: string, userId: string): string {
  return `gravity.orbit.chats.v1:${roomId}:${userId}`;
}

function emptyStore(): OrbitChatStore {
  return { version: STORE_VERSION, activeId: null, sessions: [] };
}

function readStore(roomId: string, userId: string): OrbitChatStore {
  try {
    const raw = sessionStorage.getItem(storageKey(roomId, userId));
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as OrbitChatStore;
    if (parsed?.version !== STORE_VERSION || !Array.isArray(parsed.sessions)) {
      return emptyStore();
    }
    return {
      version: STORE_VERSION,
      activeId: typeof parsed.activeId === 'string' ? parsed.activeId : null,
      sessions: parsed.sessions
        .filter((s) => s && typeof s.id === 'string' && Array.isArray(s.messages))
        .slice(0, MAX_SESSIONS),
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(roomId: string, userId: string, store: OrbitChatStore): void {
  try {
    sessionStorage.setItem(storageKey(roomId, userId), JSON.stringify(store));
  } catch {
    /* private mode / quota — ignore */
  }
}

function titleFromMessages(messages: OrbitStoredMessage[]): string {
  const first = messages.find((m) => m.role === 'user' && m.text.trim());
  if (!first) return 'New chat';
  const t = first.text
    .replace(/\n\n(?:Canvas context(?:\s*\(\d+\))?\s*:|Using(?:\s*\(\d+\))?\s*:)\s*[\s\S]*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return 'New chat';
  return t.length > 42 ? `${t.slice(0, 42)}…` : t;
}

export function sanitizeMessagesForStorage(
  messages: Array<{
    role: 'user' | 'assistant';
    text: string;
    thinking?: boolean;
    streaming?: boolean;
    attachments?: Array<{ name: string }>;
  }>,
): OrbitStoredMessage[] {
  return messages
    .filter((m) => !m.thinking && !m.streaming && m.text.trim())
    .slice(-MAX_MESSAGES)
    .map((m) => ({
      role: m.role,
      text: m.text.trim().slice(0, MAX_TEXT),
      at: Date.now(),
      attachmentNames: m.attachments?.map((a) => a.name).slice(0, ORBIT_MAX_ATTACHMENTS),
    }));
}

/** Load the active session for this tab identity + room (never crosses users/rooms). */
export function loadActiveOrbitChat(
  roomId: string | undefined,
  userId: string | undefined,
): { sessionId: string | null; messages: OrbitStoredMessage[] } {
  if (!roomId || !userId) return { sessionId: null, messages: [] };
  const store = readStore(roomId, userId);
  const active =
    store.sessions.find((s) => s.id === store.activeId) ?? store.sessions[0] ?? null;
  if (!active) return { sessionId: null, messages: [] };
  return { sessionId: active.id, messages: active.messages };
}

export function listOrbitChatSessions(
  roomId: string | undefined,
  userId: string | undefined,
): OrbitChatSession[] {
  if (!roomId || !userId) return [];
  return [...readStore(roomId, userId).sessions].sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Persist the current thread. Creates a session if needed. */
export function persistOrbitChat(
  roomId: string | undefined,
  userId: string | undefined,
  sessionId: string | null,
  messages: Array<{
    role: 'user' | 'assistant';
    text: string;
    thinking?: boolean;
    streaming?: boolean;
    attachments?: Array<{ name: string }>;
  }>,
): string | null {
  if (!roomId || !userId) return sessionId;
  const stored = sanitizeMessagesForStorage(messages);
  // Don't wipe a good session while a turn is mid-stream (empty sanitize).
  if (messages.some((m) => m.thinking || m.streaming)) return sessionId;

  const store = readStore(roomId, userId);
  const now = Date.now();
  let id = sessionId;

  if (!stored.length) {
    // Empty chat: keep placeholder session only if it already exists.
    if (id) {
      const idx = store.sessions.findIndex((s) => s.id === id);
      if (idx >= 0) {
        store.sessions[idx] = {
          ...store.sessions[idx]!,
          messages: [],
          title: 'New chat',
          updatedAt: now,
        };
        store.activeId = id;
        writeStore(roomId, userId, store);
      }
    }
    return id;
  }

  if (!id || !store.sessions.some((s) => s.id === id)) {
    id = nanoid(OBJECT_ID_LENGTH);
    store.sessions.unshift({
      id,
      title: titleFromMessages(stored),
      createdAt: now,
      updatedAt: now,
      messages: stored,
    });
  } else {
    store.sessions = store.sessions.map((s) =>
      s.id === id
        ? {
            ...s,
            title: titleFromMessages(stored),
            updatedAt: now,
            messages: stored,
          }
        : s,
    );
  }

  store.activeId = id;
  store.sessions = store.sessions
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_SESSIONS);
  writeStore(roomId, userId, store);
  return id;
}

/** Start a fresh chat; previous non-empty sessions remain in history. */
export function startNewOrbitChat(
  roomId: string | undefined,
  userId: string | undefined,
  previousSessionId: string | null,
  previousMessages: Array<{
    role: 'user' | 'assistant';
    text: string;
    thinking?: boolean;
    streaming?: boolean;
    attachments?: Array<{ name: string }>;
  }>,
): string {
  if (roomId && userId) {
    persistOrbitChat(roomId, userId, previousSessionId, previousMessages);
  }
  const id = nanoid(OBJECT_ID_LENGTH);
  if (!roomId || !userId) return id;

  const store = readStore(roomId, userId);
  const now = Date.now();
  store.sessions.unshift({
    id,
    title: 'New chat',
    createdAt: now,
    updatedAt: now,
    messages: [],
  });
  store.activeId = id;
  store.sessions = store.sessions.slice(0, MAX_SESSIONS);
  writeStore(roomId, userId, store);
  return id;
}

export function switchOrbitChat(
  roomId: string | undefined,
  userId: string | undefined,
  sessionId: string,
): OrbitStoredMessage[] {
  if (!roomId || !userId) return [];
  const store = readStore(roomId, userId);
  const session = store.sessions.find((s) => s.id === sessionId);
  if (!session) return [];
  store.activeId = sessionId;
  writeStore(roomId, userId, store);
  return session.messages;
}

export function deleteOrbitChat(
  roomId: string | undefined,
  userId: string | undefined,
  sessionId: string,
): { activeId: string | null; messages: OrbitStoredMessage[] } {
  if (!roomId || !userId) return { activeId: null, messages: [] };
  const store = readStore(roomId, userId);
  store.sessions = store.sessions.filter((s) => s.id !== sessionId);
  if (store.activeId === sessionId) {
    store.activeId = store.sessions[0]?.id ?? null;
  }
  writeStore(roomId, userId, store);
  const active = store.sessions.find((s) => s.id === store.activeId);
  return { activeId: store.activeId, messages: active?.messages ?? [] };
}

export function formatOrbitChatTime(at: number): string {
  const diff = Date.now() - at;
  if (diff < 60_000) return 'Just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
