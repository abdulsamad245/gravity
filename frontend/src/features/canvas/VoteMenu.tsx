import { ChevronDown, ThumbsUp } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Tooltip } from '../../shared/components/Tooltip';
import type { Identity } from '../../shared/types';
import {
  hasVoted,
  initials,
  normalizeVotes,
  toggleVote,
  voteCount,
  voteTimeLabel,
} from '../../shared/utils/votes';
import type { RoomConnection } from '../collaboration/RoomConnection';
import { sessionVotesForObject, useWorkshopState } from '../collaboration/useWorkshopState';

interface Props {
  conn: RoomConnection;
  objectId: string;
  votes: unknown;
  identity: Identity;
  locked?: boolean;
  variant?: 'chip' | 'toolbar';
  onChange: (next: ReturnType<typeof toggleVote>) => void;
}

export function VoteMenu({ conn, objectId, votes, identity, locked = false, variant = 'chip', onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<number | null>(null);
  const workshop = useWorkshopState(conn);
  const session = workshop.voting;
  const sessionVoters = sessionVotesForObject(workshop, objectId);
  const list = session
    ? sessionVoters.map((voter) => ({ ...voter, at: session.revealedAt ?? 0 }))
    : normalizeVotes(votes);
  const count = session ? sessionVoters.length : voteCount(votes);
  const mine = session
    ? (workshop.ballots[identity.id] ?? []).includes(objectId)
    : hasVoted(votes, identity.id);
  const sessionActive = session?.status === 'active';
  const myBallot = workshop.ballots[identity.id] ?? [];
  const atVoteLimit = sessionActive && !mine && myBallot.length >= (session?.voteLimit ?? 0);
  const effectiveLocked = locked || session?.status === 'revealed' || atVoteLimit;
  const isToolbar = variant === 'toolbar';

  const clearHoverTimer = () => {
    if (hoverTimer.current != null) {
      window.clearTimeout(hoverTimer.current);
      hoverTimer.current = null;
    }
  };

  const openDetailsSoon = () => {
    clearHoverTimer();
    hoverTimer.current = window.setTimeout(() => setOpen(true), 80);
  };

  const closeDetailsSoon = () => {
    clearHoverTimer();
    hoverTimer.current = window.setTimeout(() => setOpen(false), 160);
  };

  useEffect(() => () => clearHoverTimer(), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const cast = () => {
    if (effectiveLocked) return;
    if (sessionActive) conn.toggleSessionVote(objectId);
    else onChange(toggleVote(votes, identity));
  };

  const castLabel = locked
    ? 'Unlock to vote'
    : mine
      ? 'Remove your vote'
      : atVoteLimit
        ? `Vote limit reached (${session?.voteLimit ?? 0})`
        : sessionActive
          ? `Cast a hidden vote (${myBallot.length}/${session?.voteLimit ?? 0})`
          : 'Add your vote';
  const sessionProgress =
    sessionActive && session ? `${myBallot.length}/${session.voteLimit}` : null;
  const sessionAnonymous = session?.anonymous !== false;

  return (
    <div
      className={`vote-menu ${variant}${sessionActive ? ' session-active' : ''}${mine ? ' has-mine' : ''}`}
      ref={rootRef}
      onMouseEnter={count > 0 || sessionActive ? openDetailsSoon : undefined}
      onMouseLeave={closeDetailsSoon}
    >
      <div className="vote-menu-split">
        {isToolbar ? (
          <Tooltip label={castLabel} side="top">
            <button
              type="button"
              className={`vote-cast vote-cast-compact ${mine ? 'voted' : ''}`}
              aria-pressed={mine}
              aria-label={castLabel}
              disabled={effectiveLocked}
              onClick={cast}
            >
              <ThumbsUp size={15} strokeWidth={2.2} aria-hidden />
              {sessionProgress ? (
                <em className="vote-count">{sessionProgress}</em>
              ) : (
                !sessionActive && count > 0 && <em className="vote-count">{count}</em>
              )}
            </button>
          </Tooltip>
        ) : (
          <button
            type="button"
            className={`vote-cast btn selection-chip ${mine ? 'voted' : ''}`}
            aria-pressed={mine}
            aria-label={castLabel}
            disabled={effectiveLocked}
            onClick={cast}
          >
            <ThumbsUp size={14} strokeWidth={2.2} aria-hidden />
            <span>{mine ? 'Voted' : 'Vote'}</span>
            {sessionProgress ? (
              <em className="vote-count">{sessionProgress}</em>
            ) : (
              !sessionActive && count > 0 && <em className="vote-count">{count}</em>
            )}
          </button>
        )}
        <button
          type="button"
          className={`vote-details-btn ${open ? 'open' : ''}`}
          aria-label={
            sessionActive
              ? 'Ballot details'
              : count
                ? `View ${count} votes`
                : 'Vote details'
          }
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => {
            clearHoverTimer();
            setOpen((v) => !v);
          }}
        >
          <ChevronDown size={14} strokeWidth={2.25} aria-hidden />
        </button>
      </div>

      {open && (
        <div
          className="vote-popover panel"
          role="dialog"
          aria-label="Votes"
          onMouseEnter={openDetailsSoon}
          onMouseLeave={closeDetailsSoon}
        >
          <header className="vote-popover-head">
            <strong>
              {sessionActive
                ? session?.prompt?.trim() || 'Hidden ballot'
                : count === 0
                  ? 'No votes yet'
                  : `${count} vote${count === 1 ? '' : 's'}`}
            </strong>
            {sessionActive && session && (
              <span>
                {atVoteLimit
                  ? `Limit reached (${myBallot.length}/${session.voteLimit})`
                  : mine
                    ? `Saved (${myBallot.length}/${session.voteLimit}) · hidden until reveal`
                    : `${myBallot.length}/${session.voteLimit} used · hidden until reveal`}
              </span>
            )}
            {session?.status === 'revealed' && sessionAnonymous && <span>Anonymous tallies</span>}
            {session?.status === 'revealed' && !sessionAnonymous && count > 0 && <span>Who voted</span>}
            {!session && count > 0 && <span>Who upvoted</span>}
          </header>
          {list.length > 0 && !(session?.status === 'revealed' && sessionAnonymous) && (
            <ul className="vote-list">
              {list.map((v) => {
                const you = v.id === identity.id;
                return (
                  <li key={v.id} className={you ? 'you' : undefined}>
                    <span className="vote-avatar" style={{ background: v.color }} aria-hidden>
                      {initials(v.name)}
                    </span>
                    <span className="vote-meta">
                      <strong>
                        {v.name}
                        {you ? ' (you)' : ''}
                      </strong>
                      {voteTimeLabel(v.at) ? <em>{voteTimeLabel(v.at)}</em> : null}
                    </span>
                    {you && !effectiveLocked && (
                      <button type="button" className="vote-remove" onClick={cast}>
                        Undo
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {session?.status === 'revealed' && sessionAnonymous && count > 0 && (
            <p className="vote-anon-summary">{count} anonymous vote{count === 1 ? '' : 's'}</p>
          )}
          {!effectiveLocked && (
            <button type="button" className={`btn vote-popover-cta ${mine ? '' : 'btn-accent'}`} onClick={cast}>
              <ThumbsUp size={14} aria-hidden />
              {mine ? 'Remove vote' : 'Add vote'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
