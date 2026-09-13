import type { SharedTimerState } from '../../shared/types';
import type { RoomConnection } from '../collaboration/RoomConnection';

export function timerRemainingMs(timer: SharedTimerState | null | undefined, now = Date.now()): number {
  if (!timer) return 0;
  if (typeof timer.pausedMs === 'number' && timer.pausedMs > 0) return timer.pausedMs;
  if (typeof timer.endsAt === 'number') return Math.max(0, timer.endsAt - now);
  return 0;
}

export function isTimerRunning(timer: SharedTimerState | null | undefined, now = Date.now()): boolean {
  return !!timer && timer.endsAt != null && timer.pausedMs == null && timerRemainingMs(timer, now) > 0;
}

export function isTimerPaused(timer: SharedTimerState | null | undefined): boolean {
  return !!timer && typeof timer.pausedMs === 'number' && timer.pausedMs > 0 && timer.endsAt == null;
}

/** Last-write-wins across awareness (and legacy `timerEndsAt`). */
export function resolveSharedTimer(conn: RoomConnection): SharedTimerState | null {
  let best: SharedTimerState | null = null;
  let bestAt = -1;
  let legacyMax: number | null = null;

  conn.awareness.getStates().forEach((raw) => {
    const s = raw as {
      timer?: SharedTimerState | null;
      timerEndsAt?: number | null;
    };
    if (s.timer && typeof s.timer.updatedAt === 'number') {
      if (s.timer.updatedAt >= bestAt) {
        bestAt = s.timer.updatedAt;
        best = s.timer;
      }
    }
    if (typeof s.timerEndsAt === 'number' && (legacyMax == null || s.timerEndsAt > legacyMax)) {
      legacyMax = s.timerEndsAt;
    }
  });

  if (best) return best;
  if (legacyMax != null) {
    return { endsAt: legacyMax, pausedMs: null, musicId: null, updatedAt: 0 };
  }
  return null;
}

export function publishSharedTimer(conn: RoomConnection, timer: SharedTimerState | null): void {
  conn.setPresence({
    timer,
    // Keep legacy field in sync so older tabs still see a running clock.
    timerEndsAt: timer?.endsAt ?? null,
  });
}

export function startSharedTimer(
  conn: RoomConnection,
  seconds: number,
  musicId: string | null,
): SharedTimerState {
  const sec = Math.max(1, Math.floor(seconds));
  const next: SharedTimerState = {
    endsAt: Date.now() + sec * 1000,
    pausedMs: null,
    musicId: musicId && musicId !== 'none' ? musicId : null,
    updatedAt: Date.now(),
  };
  publishSharedTimer(conn, next);
  return next;
}

export function pauseSharedTimer(conn: RoomConnection, timer: SharedTimerState): SharedTimerState {
  const rem = timerRemainingMs(timer);
  const next: SharedTimerState = {
    endsAt: null,
    pausedMs: rem,
    musicId: timer.musicId,
    updatedAt: Date.now(),
  };
  publishSharedTimer(conn, next);
  return next;
}

export function resumeSharedTimer(conn: RoomConnection, timer: SharedTimerState): SharedTimerState {
  const rem = timer.pausedMs ?? timerRemainingMs(timer);
  const next: SharedTimerState = {
    endsAt: Date.now() + Math.max(1, rem),
    pausedMs: null,
    musicId: timer.musicId,
    updatedAt: Date.now(),
  };
  publishSharedTimer(conn, next);
  return next;
}

export function addSharedTimerSeconds(
  conn: RoomConnection,
  timer: SharedTimerState | null,
  seconds: number,
  musicId: string | null,
): SharedTimerState {
  const add = Math.max(1, Math.floor(seconds)) * 1000;
  if (!timer || (timer.endsAt == null && timer.pausedMs == null)) {
    return startSharedTimer(conn, seconds, musicId);
  }
  if (isTimerPaused(timer)) {
    const next: SharedTimerState = {
      endsAt: null,
      pausedMs: (timer.pausedMs ?? 0) + add,
      musicId: timer.musicId ?? musicId,
      updatedAt: Date.now(),
    };
    publishSharedTimer(conn, next);
    return next;
  }
  const base = timer.endsAt && timer.endsAt > Date.now() ? timer.endsAt : Date.now();
  const next: SharedTimerState = {
    endsAt: base + add,
    pausedMs: null,
    musicId: timer.musicId ?? musicId,
    updatedAt: Date.now(),
  };
  publishSharedTimer(conn, next);
  return next;
}

export function clearSharedTimer(conn: RoomConnection): void {
  publishSharedTimer(conn, null);
}

export function setSharedTimerMusic(
  conn: RoomConnection,
  timer: SharedTimerState | null,
  musicId: string | null,
): SharedTimerState | null {
  if (!timer) return null;
  const next: SharedTimerState = {
    ...timer,
    musicId: musicId && musicId !== 'none' ? musicId : null,
    updatedAt: Date.now(),
  };
  publishSharedTimer(conn, next);
  return next;
}
