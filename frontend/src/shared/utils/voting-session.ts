import type { ObjectVote, WorkshopVoter } from '../types';
import { normalizeVotes } from './votes';

/** Neutral chip color when session results are anonymous. */
export const ANON_VOTE_COLOR = '#8b92a5';

/** Stable id so session tallies can merge onto objects without colliding with public upvotes. */
export function sessionBallotVoteId(sessionId: string, voterId: string): string {
  return `vote:${sessionId}:${voterId}`;
}

export function votersForObjectId(
  ballots: Record<string, string[]>,
  voters: Record<string, WorkshopVoter>,
  objectId: string,
): WorkshopVoter[] {
  const out: WorkshopVoter[] = [];
  for (const [voterId, objectIds] of Object.entries(ballots)) {
    if (!objectIds.includes(objectId)) continue;
    const voter = voters[voterId];
    if (voter) out.push(voter);
  }
  return out;
}

/** Write session ballots onto object.votes so counts survive Clear (and feed physics mass). */
export function mergeBallotsOntoObjectVotes(
  existingVotes: unknown,
  votersForObject: WorkshopVoter[],
  sessionId: string,
  anonymous: boolean,
  at: number,
): ObjectVote[] {
  const prefix = `vote:${sessionId}:`;
  const kept = normalizeVotes(existingVotes).filter((v) => !v.id.startsWith(prefix));
  const added: ObjectVote[] = votersForObject.map((voter) => ({
    id: sessionBallotVoteId(sessionId, voter.id),
    name: anonymous ? 'Anonymous' : voter.name,
    color: anonymous ? ANON_VOTE_COLOR : voter.color,
    at,
  }));
  return [...kept, ...added];
}

export function anonymizeVoter(voter: WorkshopVoter): WorkshopVoter {
  return { ...voter, name: 'Anonymous', color: ANON_VOTE_COLOR };
}
