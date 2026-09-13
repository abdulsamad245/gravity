import type { ReplayLogEntry } from '../../shared/api/client';

export type ParsedSessionReplay = {
  entries: ReplayLogEntry[];
  room?: string;
};

export type SessionReplayParseError = {
  error: true;
  /** Short copy for people using the app. */
  message: string;
  /** Extra context for debugging (file shape, kind, etc.). */
  details?: string;
};

/**
 * Validates a downloaded session-history JSON file so users can reopen it
 * in the in-app replay player.
 */
export function parseSessionReplayFile(
  text: string,
): ParsedSessionReplay | SessionReplayParseError {
  let raw: unknown;
  try {
    raw = JSON.parse(text) as unknown;
  } catch (err) {
    return {
      error: true,
      message: 'That file is not valid JSON. Export session history again from Replay.',
      details: err instanceof Error ? err.message : 'JSON.parse failed',
    };
  }

  if (!raw || typeof raw !== 'object') {
    return {
      error: true,
      message: 'That file does not look like a Gravity session history.',
      details: `Root type: ${raw === null ? 'null' : typeof raw}`,
    };
  }

  const body = raw as {
    kind?: unknown;
    entries?: unknown;
    room?: unknown;
  };

  if (body.kind !== 'session-replay') {
    return {
      error: true,
      message:
        'This is not a session history file. Board JSON uses Import board. Session history files are saved from Replay → Export → Save session history.',
      details: `Expected kind "session-replay", got ${JSON.stringify(body.kind ?? null)}`,
    };
  }

  if (!Array.isArray(body.entries) || body.entries.length === 0) {
    return {
      error: true,
      message: 'That session history has no steps to play.',
      details: Array.isArray(body.entries)
        ? `entries length: ${body.entries.length}`
        : `entries type: ${typeof body.entries}`,
    };
  }

  const entries: ReplayLogEntry[] = [];
  for (let i = 0; i < body.entries.length; i++) {
    const item = body.entries[i];
    if (!item || typeof item !== 'object') {
      return {
        error: true,
        message: 'That session history file is damaged and cannot be opened.',
        details: `Invalid entry at index ${i}`,
      };
    }
    const entry = item as { t?: unknown; u?: unknown };
    if (typeof entry.t !== 'number' || typeof entry.u !== 'string' || !entry.u) {
      return {
        error: true,
        message: 'That session history file is damaged and cannot be opened.',
        details: `Invalid entry at index ${i}: expected { t: number, u: string }`,
      };
    }
    entries.push({ t: entry.t, u: entry.u });
  }

  return {
    entries,
    room: typeof body.room === 'string' ? body.room : undefined,
  };
}
