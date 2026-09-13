import { useEffect, useState } from 'react';
import type { WorkshopState, WorkshopVoter } from '../../shared/types';
import { anonymizeVoter } from '../../shared/utils/voting-session';
import type { RoomConnection } from './RoomConnection';

function readWorkshopState(conn: RoomConnection): WorkshopState {
  const ballots: Record<string, string[]> = {};
  conn.votingBallots.forEach((ballot, voterId) => {
    ballots[voterId] = ballot.toArray();
  });

  const voters: Record<string, WorkshopVoter> = {};
  conn.votingVoters.forEach((voter, voterId) => {
    voters[voterId] = voter;
  });

  return {
    privateBrainstorm: conn.getPrivateBrainstorm(),
    voting: conn.getVotingSession(),
    ballots,
    voters,
  };
}

/** React bridge for shared workshop configuration and private ballots. */
export function useWorkshopState(conn: RoomConnection): WorkshopState {
  const [state, setState] = useState<WorkshopState>(() => readWorkshopState(conn));

  useEffect(() => {
    const sync = () => setState(readWorkshopState(conn));
    conn.workshop.observe(sync);
    conn.votingBallots.observeDeep(sync);
    conn.votingVoters.observe(sync);
    sync();
    return () => {
      conn.workshop.unobserve(sync);
      conn.votingBallots.unobserveDeep(sync);
      conn.votingVoters.unobserve(sync);
    };
  }, [conn]);

  return state;
}

export function sessionVotesForObject(state: WorkshopState, objectId: string): WorkshopVoter[] {
  if (state.voting?.status !== 'revealed') return [];
  const anonymous = state.voting.anonymous !== false;
  const voters: WorkshopVoter[] = [];
  for (const [voterId, objectIds] of Object.entries(state.ballots)) {
    if (!objectIds.includes(objectId)) continue;
    const voter = state.voters[voterId];
    if (!voter) continue;
    voters.push(anonymous ? anonymizeVoter(voter) : voter);
  }
  return voters;
}
