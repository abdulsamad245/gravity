import { describe, expect, it } from 'vitest';
import {
  mergeBallotsOntoObjectVotes,
  sessionBallotVoteId,
  votersForObjectId,
} from './voting-session';

describe('voting-session', () => {
  it('lists voters for an object from ballots', () => {
    const voters = votersForObjectId(
      { a: ['o1', 'o2'], b: ['o1'] },
      {
        a: { id: 'a', name: 'Ada', color: '#f00' },
        b: { id: 'b', name: 'Bea', color: '#0f0' },
      },
      'o1',
    );
    expect(voters.map((v) => v.id)).toEqual(['a', 'b']);
  });

  it('merges anonymous session ballots without wiping public upvotes', () => {
    const merged = mergeBallotsOntoObjectVotes(
      [{ id: 'pub', name: 'Pat', color: '#00f', at: 1 }],
      [{ id: 'a', name: 'Ada', color: '#f00' }],
      'sess1',
      true,
      99,
    );
    expect(merged).toEqual([
      { id: 'pub', name: 'Pat', color: '#00f', at: 1 },
      { id: sessionBallotVoteId('sess1', 'a'), name: 'Anonymous', color: '#8b92a5', at: 99 },
    ]);
  });

  it('replaces prior merges for the same session id', () => {
    const first = mergeBallotsOntoObjectVotes(
      [],
      [{ id: 'a', name: 'Ada', color: '#f00' }],
      'sess1',
      false,
      10,
    );
    const second = mergeBallotsOntoObjectVotes(
      first,
      [
        { id: 'a', name: 'Ada', color: '#f00' },
        { id: 'b', name: 'Bea', color: '#0f0' },
      ],
      'sess1',
      false,
      20,
    );
    expect(second).toHaveLength(2);
    expect(second.every((v) => v.at === 20)).toBe(true);
  });
});
