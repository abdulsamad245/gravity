/** Canonical live-board URL path: `/rooms/:roomId` (collection + id). */
export function roomPath(roomId: string): string {
  return `/rooms/${roomId}`;
}

/** Accept `/rooms/:id` or legacy `/room/:id` in pasted invite links. */
export function parseRoomIdFromInput(value: string): string | null {
  const match = value.trim().match(/\/rooms?\/([A-Za-z0-9_-]{4,64})\b/i);
  if (match?.[1]) return match[1];
  const bare = value.trim().match(/^([A-Za-z0-9_-]{4,64})$/);
  return bare?.[1] ?? null;
}
