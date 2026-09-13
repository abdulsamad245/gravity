import { colorForName } from './identity';
import type { Identity, ObjectVote } from '../types';

/** Normalize legacy string[] votes and partial objects into ObjectVote[]. */
export function normalizeVotes(raw: unknown): ObjectVote[] {
  if (!Array.isArray(raw)) return [];
  const out: ObjectVote[] = [];
  for (const v of raw) {
    if (typeof v === 'string' && v) {
      out.push({ id: v, name: 'Someone', color: colorForName(v), at: 0 });
      continue;
    }
    if (v && typeof v === 'object' && 'id' in v) {
      const o = v as Partial<ObjectVote>;
      const id = String(o.id ?? '');
      if (!id) continue;
      out.push({
        id,
        name: (o.name && String(o.name).trim()) || 'Someone',
        color: o.color || colorForName(id),
        at: typeof o.at === 'number' ? o.at : 0,
      });
    }
  }
  return out;
}

/** Ballot size after normalizing legacy string votes; used by physics mass scaling. */
export function voteCount(raw: unknown): number {
  return normalizeVotes(raw).length;
}

export function hasVoted(raw: unknown, voterId: string): boolean {
  return normalizeVotes(raw).some((v) => v.id === voterId);
}

/** Toggle the current user's vote; stores name/color so details survive disconnects. */
export function toggleVote(raw: unknown, identity: Identity): ObjectVote[] {
  const cur = normalizeVotes(raw);
  if (cur.some((v) => v.id === identity.id)) {
    return cur.filter((v) => v.id !== identity.id);
  }
  return [
    ...cur,
    {
      id: identity.id,
      name: identity.name,
      color: identity.color,
      at: Date.now(),
    },
  ];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

export function voteTimeLabel(at: number): string {
  if (!at) return '';
  const sec = Math.round((Date.now() - at) / 1000);
  if (sec < 45) return 'just now';
  if (sec < 3600) return `${Math.max(1, Math.round(sec / 60))}m ago`;
  if (sec < 86400) return `${Math.max(1, Math.round(sec / 3600))}h ago`;
  return `${Math.max(1, Math.round(sec / 86400))}d ago`;
}
