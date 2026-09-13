import {
  Archive,
  Eye,
  EyeOff,
  Hand,
  LayoutGrid,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  SmilePlus,
  Square,
  Target,
  Vote,
  Vibrate,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { CloseButton } from '../../shared/components/CloseButton';
import { SelectMenu } from '../../shared/components/SelectMenu';
import { dialogConfirm } from '../../shared/components/DialogHost';
import {
  FACILITATION_REACTIONS,
  TIMER_ADD_OPTIONS_SEC,
  TIMER_CUSTOM_MAX_MIN,
  TIMER_CUSTOM_MAX_SEC,
  TIMER_CUSTOM_MIN,
  TIMER_MUSIC_TRACKS,
  TIMER_PRESETS_SEC,
  VOTING_DURATION_PRESETS_SEC,
  VOTING_VOTE_LIMIT_MAX,
  VOTING_VOTE_LIMIT_MIN,
} from '../../shared/constants/facilitation.constants';
import { GIF_STICKERS } from '../../shared/constants/gifs.constants';
import { ALL_STICKERS } from '../../shared/constants/stickers.constants';
import type { AwarenessState, SharedTimerState } from '../../shared/types';
import { clamp } from '../../shared/utils/geometry';
import { useUiStore } from '../../stores/ui.store';
import { StickersFlyout } from '../canvas/StickersFlyout';
import type { RoomConnection } from '../collaboration/RoomConnection';
import { useWorkshopState } from '../collaboration/useWorkshopState';
import {
  placeArchiveWell,
  placeMagnet,
  settleObjects,
  triggerBoardShake,
} from '../physics/physics-actions';
import {
  addSharedTimerSeconds,
  clearSharedTimer,
  isTimerPaused,
  isTimerRunning,
  pauseSharedTimer,
  resolveSharedTimer,
  resumeSharedTimer,
  setSharedTimerMusic,
  startSharedTimer,
  timerRemainingMs,
} from './shared-timer';
import { playTimerEndedChime } from './timer-chime';
import { stopTimerMusic, syncTimerMusic } from './timer-music';

interface Props {
  conn: RoomConnection;
  /** Tighter layout for the mobile presence sheet. */
  compact?: boolean;
  /** Desktop dropdown dismiss; omitted when embedded in the mobile more menu. */
  onClose?: () => void;
}

function formatCountdown(totalSec: number): string {
  const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
  const ss = String(totalSec % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

function reactionAnchor(conn: RoomConnection): { x: number; y: number } {
  const local = (conn.awareness.getLocalState() ?? {}) as AwarenessState;
  if (local.cursor) return { x: local.cursor.x, y: local.cursor.y };
  if (local.viewport) {
    return { x: local.viewport.x + local.viewport.w / 2, y: local.viewport.y + local.viewport.h / 2 };
  }
  return { x: 0, y: 0 };
}

const FACIL_STICKER_PREVIEW = ALL_STICKERS.slice(0, 8);
const FACIL_GIF_PREVIEW = GIF_STICKERS.slice(0, 3);

export function FacilitationMenu({ conn, compact = false, onClose }: Props) {
  const {
    setSharedTimer,
    sharedTimer,
    setTimerEndsAt,
    stampGlyph,
    stampGifSrc,
    setStampGlyph,
    setStampGifSrc,
    setTool,
  } = useUiStore();
  const [now, setNow] = useState(Date.now());
  const [customOpen, setCustomOpen] = useState(false);
  const [customMin, setCustomMin] = useState(3);
  const [customSec, setCustomSec] = useState(0);
  const [musicId, setMusicId] = useState('none');
  const [musicMuted, setMusicMuted] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [stickersOpen, setStickersOpen] = useState(false);
  const [votePrompt, setVotePrompt] = useState('Vote for the strongest ideas');
  const [voteLimit, setVoteLimit] = useState(3);
  const [voteAnonymous, setVoteAnonymous] = useState(true);
  const [voteDurationSec, setVoteDurationSec] = useState(0);
  const workshop = useWorkshopState(conn);
  const privateRound = workshop.privateBrainstorm;
  const voting = workshop.voting;
  const canManagePrivate = !!privateRound && (privateRound.startedBy === conn.identity.id || conn.isOwner());
  const canManageVoting = !!voting && (voting.startedBy === conn.identity.id || conn.isOwner());
  const myBallot = workshop.ballots[conn.identity.id] ?? [];
  const myVoteCount = myBallot.length;
  const myVotingDone = workshop.voters[conn.identity.id]?.done === true;
  const votersWhoCast = Object.values(workshop.ballots).filter((ids) => ids.length > 0).length;
  const votersDone = Object.values(workshop.voters).filter((v) => v.done).length;
  const totalBallotsCast = Object.values(workshop.ballots).reduce((sum, ids) => sum + ids.length, 0);
  const votingRemainingMs =
    voting?.status === 'active' && voting.endsAt != null ? Math.max(0, voting.endsAt - now) : null;
  const votingRemainingSec =
    votingRemainingMs != null ? Math.ceil(votingRemainingMs / 1000) : null;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    conn.checkVotingDeadline();
  }, [conn, now, voting?.status, voting?.endsAt]);

  useEffect(() => {
    const sync = () => {
      const t = resolveSharedTimer(conn);
      setSharedTimer(t);
      setTimerEndsAt(t?.endsAt ?? null);
      if (t?.musicId) setMusicId(t.musicId);
      const local = conn.awareness.getLocalState() as AwarenessState | null;
      setHandRaised(!!local?.handRaised);
    };
    conn.awareness.on('change', sync);
    sync();
    return () => conn.awareness.off('change', sync);
  }, [conn, setSharedTimer, setTimerEndsAt]);

  const timer = sharedTimer;
  const remainingMs = timerRemainingMs(timer, now);
  const remainingSec = Math.ceil(remainingMs / 1000);
  const running = isTimerRunning(timer, now);
  const paused = isTimerPaused(timer);
  const ended = !!timer && !paused && remainingMs === 0 && (timer.endsAt != null || timer.pausedMs === 0);

  useEffect(() => {
    syncTimerMusic(running ? timer?.musicId ?? musicId : null, running && !musicMuted);
    return () => {
      if (!running) stopTimerMusic();
    };
  }, [running, timer?.musicId, musicId, musicMuted]);

  const applyTimer = (next: SharedTimerState | null) => {
    setSharedTimer(next);
    setTimerEndsAt(next?.endsAt ?? null);
  };

  const startSeconds = (seconds: number) => {
    applyTimer(startSharedTimer(conn, seconds, musicId));
    setCustomOpen(false);
  };

  const startCustom = () => {
    const total = customMin * 60 + customSec;
    if (total < 1) return;
    startSeconds(total);
  };

  const onPauseResume = () => {
    if (!timer) return;
    if (running) applyTimer(pauseSharedTimer(conn, timer));
    else if (paused) applyTimer(resumeSharedTimer(conn, timer));
  };

  const onAdd = (seconds: number) => {
    applyTimer(addSharedTimerSeconds(conn, timer, seconds, musicId));
  };

  const onStop = () => {
    clearSharedTimer(conn);
    applyTimer(null);
    stopTimerMusic();
  };

  const onMusicChange = (id: string) => {
    setMusicId(id);
    if (timer) applyTimer(setSharedTimerMusic(conn, timer, id));
  };

  const fireReaction = (glyph: string) => {
    const { x, y } = reactionAnchor(conn);
    conn.setPresence({
      reaction: { glyph, x, y, at: Date.now() },
    });
  };

  const toggleHand = () => {
    const next = !handRaised;
    setHandRaised(next);
    conn.setPresence({ handRaised: next });
  };

  const pickStickerGlyph = (glyph: string) => {
    setStampGifSrc(null);
    setStampGlyph(glyph);
    setTool('stamp');
  };

  const pickStickerGif = (src: string) => {
    setStampGifSrc(src);
    setTool('stamp');
  };

  const status = running
    ? 'Live in room'
    : paused
      ? 'Paused'
      : ended
        ? 'Time up'
        : voting?.status === 'active'
          ? 'Voting'
          : voting?.status === 'revealed'
            ? 'Results out'
            : 'Ready';
  const statusTone = running
    ? 'live'
    : ended
      ? 'ended'
      : paused
        ? 'paused'
        : voting
          ? 'live'
          : '';

  return (
    <div
      className={`facilitation-menu${compact ? ' compact' : ''}`}
      role="dialog"
      aria-label="Workshop tools"
    >
      <header className="facil-top">
        <div className="facil-top-copy">
          <h2 className="facil-title">Workshop tools</h2>
          {!compact && <p className="facil-lead">Timer, votes, reactions, and board helpers</p>}
        </div>
        <div className="facil-top-actions">
          <span className={`facil-badge ${statusTone}`}>{status}</span>
          {onClose && <CloseButton onClick={onClose} label="Close workshop tools" />}
        </div>
      </header>

      <section
        className={`facil-card facil-timer ${ended ? 'ended' : paused ? 'paused' : running ? 'running' : ''}`}
        aria-label="Shared timer"
      >
        <div className="facil-section-head">
          <h3 className="facil-section-title">Timer</h3>
        </div>
        <div className="facil-timer-row">
          <div className={`timer-readout ${ended ? 'timer-ended' : ''}`} aria-live="polite">
            {timer && (running || paused || ended)
              ? ended
                ? 'Time up'
                : formatCountdown(Math.max(0, remainingSec))
              : '--:--'}
          </div>
          <div className="facil-presets" role="group" aria-label="Quick durations">
            {TIMER_PRESETS_SEC.map((p) => (
              <button key={p.label} type="button" className="facil-chip" onClick={() => startSeconds(p.seconds)}>
                {p.label}
              </button>
            ))}
            <button
              type="button"
              className={`facil-chip facil-chip-link ${customOpen ? 'active' : ''}`}
              onClick={() => setCustomOpen((v) => !v)}
              aria-expanded={customOpen}
            >
              Custom
            </button>
          </div>
        </div>

        {customOpen && (
          <div className="facil-custom-row">
            <label className="facil-inline-unit">
              <input
                type="number"
                min={TIMER_CUSTOM_MIN}
                max={TIMER_CUSTOM_MAX_MIN}
                value={customMin}
                onChange={(e) =>
                  setCustomMin(clamp(Number(e.target.value) || 0, TIMER_CUSTOM_MIN, TIMER_CUSTOM_MAX_MIN))
                }
                aria-label="Minutes"
              />
              <span>min</span>
            </label>
            <label className="facil-inline-unit">
              <input
                type="number"
                min={0}
                max={TIMER_CUSTOM_MAX_SEC}
                value={customSec}
                onChange={(e) => setCustomSec(clamp(Number(e.target.value) || 0, 0, TIMER_CUSTOM_MAX_SEC))}
                aria-label="Seconds"
              />
              <span>sec</span>
            </label>
            <button type="button" className="btn btn-primary" onClick={startCustom}>
              Start
            </button>
          </div>
        )}

        <div className="facil-music-row">
          <label className="facil-music">
            <span>Music</span>
            <SelectMenu
              value={musicId}
              options={TIMER_MUSIC_TRACKS.map((track) => ({ value: track.id, label: track.label }))}
              onChange={onMusicChange}
              ariaLabel="Timer music"
              className="facil-music-select"
            />
          </label>
          <button
            type="button"
            className="btn facil-btn-quiet"
            onClick={() => setMusicMuted((m) => !m)}
            aria-pressed={musicMuted}
          >
            {musicMuted ? 'Unmute' : 'Mute'}
          </button>
        </div>

        {!!timer && (running || paused || ended) && (
          <div className="facil-timer-actions">
            {(running || paused) && (
              <button type="button" className="btn facil-btn-quiet" onClick={onPauseResume} aria-label={paused ? 'Resume' : 'Pause'}>
                {paused ? <Play size={16} aria-hidden /> : <Pause size={16} aria-hidden />}
                {paused ? 'Resume' : 'Pause'}
              </button>
            )}
            {TIMER_ADD_OPTIONS_SEC.map((o) => (
              <button key={o.label} type="button" className="btn facil-btn-quiet" onClick={() => onAdd(o.seconds)}>
                {o.label}
              </button>
            ))}
            <button type="button" className={`btn facil-btn-quiet ${ended ? 'facil-reset-btn' : ''}`} onClick={onStop}>
              {ended ? <RotateCcw size={14} aria-hidden /> : <Square size={14} aria-hidden />}
              {ended ? 'Reset' : 'Stop'}
            </button>
          </div>
        )}
      </section>

      <section className="facil-card" aria-label="Private brainstorming">
        <div className="facil-section-head">
          <h3 className="facil-section-title">Private brainstorming</h3>
          <p className="facil-section-hint">
            {privateRound ? 'New stickies stay hidden until you reveal them' : 'Hide new stickies while people ideate'}
          </p>
        </div>
        <div className="facil-row-actions">
          {!privateRound ? (
            <button type="button" className="btn btn-primary" onClick={() => conn.startPrivateBrainstorm(true)}>
              <EyeOff size={16} strokeWidth={2} aria-hidden />
              Start private round
            </button>
          ) : (
            <>
              <span className="facil-badge live">Live</span>
              {canManagePrivate && (
                <button type="button" className="btn facil-btn-quiet" onClick={() => conn.endPrivateBrainstorm()}>
                  <Eye size={16} aria-hidden />
                  Reveal all
                </button>
              )}
            </>
          )}
        </div>
      </section>

      <section
        className={`facil-card facil-vote-card${voting ? ` is-${voting.status}` : ''}`}
        aria-label="Voting session"
      >
        <div className="facil-section-head facil-vote-head">
          <div>
            <h3 className="facil-section-title">Voting</h3>
            <p className="facil-section-hint">
              {!voting
                ? 'Results stay hidden until you reveal'
                : voting.status === 'active'
                  ? 'Select an object, then tap Vote'
                  : 'Counts stay on the board after you clear'}
            </p>
          </div>
          {voting && (
            <span className={`facil-badge ${voting.status === 'active' ? 'live' : ''}`}>
              {voting.status === 'active'
                ? votingRemainingSec != null
                  ? formatCountdown(votingRemainingSec)
                  : 'Live'
                : 'Revealed'}
            </span>
          )}
        </div>

        {!voting ? (
          <div className="facil-vote-setup">
            <label className="facil-vote-field">
              <span className="sr-only">Voting prompt</span>
              <input
                type="text"
                value={votePrompt}
                maxLength={120}
                onChange={(event) => setVotePrompt(event.target.value)}
                aria-label="Voting prompt"
                placeholder="What are we voting on?"
              />
            </label>
            <div className="facil-vote-setup-row">
              <div className="facil-inline-unit facil-vote-stepper" role="group" aria-label="Votes per person">
                <button
                  type="button"
                  className="facil-stepper-btn"
                  aria-label="Fewer votes each"
                  disabled={voteLimit <= VOTING_VOTE_LIMIT_MIN}
                  onClick={() =>
                    setVoteLimit((n) => clamp(n - 1, VOTING_VOTE_LIMIT_MIN, VOTING_VOTE_LIMIT_MAX))
                  }
                >
                  <Minus size={14} strokeWidth={2.5} aria-hidden />
                </button>
                <input
                  type="number"
                  min={VOTING_VOTE_LIMIT_MIN}
                  max={VOTING_VOTE_LIMIT_MAX}
                  value={voteLimit}
                  onChange={(event) =>
                    setVoteLimit(
                      clamp(
                        Number(event.target.value) || VOTING_VOTE_LIMIT_MIN,
                        VOTING_VOTE_LIMIT_MIN,
                        VOTING_VOTE_LIMIT_MAX,
                      ),
                    )
                  }
                  aria-label="Votes per person"
                />
                <span>each</span>
                <button
                  type="button"
                  className="facil-stepper-btn"
                  aria-label="More votes each"
                  disabled={voteLimit >= VOTING_VOTE_LIMIT_MAX}
                  onClick={() =>
                    setVoteLimit((n) => clamp(n + 1, VOTING_VOTE_LIMIT_MIN, VOTING_VOTE_LIMIT_MAX))
                  }
                >
                  <Plus size={14} strokeWidth={2.5} aria-hidden />
                </button>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  conn.startVotingSession(votePrompt, voteLimit, {
                    anonymous: voteAnonymous,
                    durationSec: voteDurationSec,
                  })
                }
              >
                <Vote size={16} strokeWidth={2} aria-hidden />
                Start voting
              </button>
            </div>
            <div className="facil-vote-options">
              <label className="facil-vote-option">
                <span>Time limit</span>
                <SelectMenu
                  ariaLabel="Voting time limit"
                  value={String(voteDurationSec)}
                  options={VOTING_DURATION_PRESETS_SEC.map((p) => ({
                    value: String(p.seconds),
                    label: p.label,
                  }))}
                  onChange={(value) => setVoteDurationSec(Number(value) || 0)}
                />
              </label>
              <label className="facil-vote-check">
                <input
                  type="checkbox"
                  checked={voteAnonymous}
                  onChange={(event) => setVoteAnonymous(event.target.checked)}
                />
                <span>Anonymous results</span>
              </label>
            </div>
          </div>
        ) : (
          <div className="facil-vote-live">
            <p className="facil-vote-prompt-text">{voting.prompt}</p>
            <div className="facil-vote-stats" aria-live="polite">
              <span className="facil-vote-stat">
                <strong>
                  {myVoteCount}/{voting.voteLimit}
                </strong>
                your votes
              </span>
              <span className="facil-vote-stat">
                <strong>{votersWhoCast}</strong>
                {votersWhoCast === 1 ? 'person' : 'people'} voted
              </span>
              <span className="facil-vote-stat">
                <strong>{votersDone}</strong>
                done
              </span>
              {voting.status === 'revealed' && (
                <span className="facil-vote-stat">
                  <strong>{totalBallotsCast}</strong>
                  total
                </span>
              )}
            </div>
            {voting.status === 'active' && Object.keys(workshop.voters).length > 0 && (
              <ul className="facil-vote-participants" aria-label="Voting progress">
                {Object.values(workshop.voters).map((voter) => {
                  const used = (workshop.ballots[voter.id] ?? []).length;
                  return (
                    <li key={voter.id}>
                      <span className="facil-vote-dot" style={{ background: voter.color }} aria-hidden />
                      <span className="facil-vote-participant-name">
                        {voter.name}
                        {voter.id === conn.identity.id ? ' (you)' : ''}
                      </span>
                      <span className="facil-vote-participant-meta">
                        {used}/{voting.voteLimit}
                        {voter.done ? ' · Done' : ''}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
            {voting.status === 'active' && !compact && (
              <p className="facil-vote-howto">
                {voting.anonymous !== false
                  ? 'Tallies stay hidden until reveal. Vote from the selection bar, then tap I\'m done when finished.'
                  : 'Tallies stay hidden until reveal. After reveal, names show on each object.'}
              </p>
            )}
            <div className="facil-row-actions">
              {voting.status === 'active' && (
                <button
                  type="button"
                  className={`btn ${myVotingDone ? 'facil-btn-quiet' : 'btn-primary'}`}
                  onClick={() => conn.setVotingDone(!myVotingDone)}
                  aria-pressed={myVotingDone}
                >
                  {myVotingDone ? 'Resume voting' : "I'm done"}
                </button>
              )}
              {voting.status === 'active' && canManageVoting && (
                <button type="button" className="btn btn-primary" onClick={() => conn.revealVotingSession()}>
                  <Eye size={16} aria-hidden />
                  Reveal results
                </button>
              )}
              {canManageVoting && (
                <button
                  type="button"
                  className="btn facil-btn-quiet"
                  onClick={async () => {
                    if (voting.status === 'active' && totalBallotsCast > 0) {
                      const ok = await dialogConfirm(
                        'End without revealing? Ballots will be discarded. Reveal first to keep counts on the board.',
                        'End voting?',
                        'End without revealing',
                      );
                      if (!ok) return;
                    }
                    conn.clearVotingSession();
                  }}
                >
                  <RotateCcw size={14} aria-hidden />
                  {voting.status === 'active' ? 'End session' : 'Clear session'}
                </button>
              )}
              {!canManageVoting && voting.status === 'active' && (
                <p className="facil-vote-waiting">Waiting for the host to reveal…</p>
              )}
            </div>
          </div>
        )}
      </section>

      <section className="facil-card" aria-label="Board physics">
        <div className="facil-section-head">
          <h3 className="facil-section-title">Board physics</h3>
          <p className="facil-section-hint">Cluster, shake, park, or tidy loose objects</p>
        </div>
        <div className="facil-physics-grid">
          <button type="button" className="facil-tile" onClick={() => placeMagnet(conn)}>
            <Target size={18} strokeWidth={2} aria-hidden />
            <span>Topic magnet</span>
          </button>
          <button type="button" className="facil-tile" onClick={() => placeArchiveWell(conn)}>
            <Archive size={18} strokeWidth={2} aria-hidden />
            <span>Archive well</span>
          </button>
          <button type="button" className="facil-tile" onClick={() => triggerBoardShake(conn)}>
            <Vibrate size={18} strokeWidth={2} aria-hidden />
            <span>Shake board</span>
          </button>
          <button type="button" className="facil-tile" onClick={() => settleObjects(conn)}>
            <LayoutGrid size={18} strokeWidth={2} aria-hidden />
            <span>Settle / align</span>
          </button>
        </div>
      </section>

      <section className="facil-card" aria-label="Reactions">
        <div className="facil-section-head facil-stickers-head">
          <div>
            <h3 className="facil-section-title">Reactions</h3>
            <p className="facil-section-hint">Show beside your cursor</p>
          </div>
          <button
            type="button"
            className={`btn facil-btn-quiet facil-hand-btn ${handRaised ? 'active' : ''}`}
            onClick={toggleHand}
            aria-pressed={handRaised}
          >
            <Hand size={16} strokeWidth={2} aria-hidden />
            {handRaised ? 'Lower hand' : 'Raise hand'}
          </button>
        </div>
        <div className="facil-stamp-grid facil-reaction-grid">
          {FACILITATION_REACTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              className="facil-stamp"
              title={s.hint}
              aria-label={s.hint}
              onClick={() => fireReaction(s.glyph)}
            >
              <span className="facil-stamp-glyph" aria-hidden>
                {s.glyph}
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="facil-card" aria-label="Stickers, emoji and GIFs">
        <div className="facil-section-head facil-stickers-head">
          <div>
            <h3 className="facil-section-title">Stickers &amp; GIFs</h3>
            <p className="facil-section-hint">Quick picks for the stamp tool</p>
          </div>
          <button
            type="button"
            className={`btn facil-btn-quiet facil-stickers-more ${stickersOpen ? 'active' : ''}`}
            aria-expanded={stickersOpen}
            onClick={() => setStickersOpen((open) => !open)}
          >
            <SmilePlus size={15} strokeWidth={2} aria-hidden />
            {stickersOpen ? 'Close' : 'More'}
          </button>
        </div>
        {!stickersOpen && (
          <div className="facil-stickers-preview" role="group" aria-label="Quick stickers">
            {FACIL_STICKER_PREVIEW.map((glyph) => (
              <button
                key={`fs-${glyph}`}
                type="button"
                className={`facil-sticker-cell ${!stampGifSrc && stampGlyph === glyph ? 'active' : ''}`}
                aria-label={`Place ${glyph}`}
                onClick={() => pickStickerGlyph(glyph)}
              >
                {glyph}
              </button>
            ))}
            {FACIL_GIF_PREVIEW.map((g) => (
              <button
                key={g.id}
                type="button"
                className={`facil-sticker-cell facil-gif-cell ${stampGifSrc === g.src ? 'active' : ''}`}
                aria-label={`Place GIF ${g.label}`}
                onClick={() => pickStickerGif(g.src)}
              >
                <img src={g.preview ?? g.src} alt="" loading="lazy" draggable={false} />
              </button>
            ))}
          </div>
        )}
        {stickersOpen && (
          <div className="facil-stickers-panel">
            <StickersFlyout onClose={() => setStickersOpen(false)} />
          </div>
        )}
      </section>
    </div>
  );
}

/**
 * Keeps awareness timer synced when the popover is closed.
 * Chime + music stop on zero. The ended state persists until someone resets it.
 */
export function useFacilitationTimerSync(conn: RoomConnection): string | null {
  const { sharedTimer, setSharedTimer, setTimerEndsAt } = useUiStore();
  const [now, setNow] = useState(Date.now());
  const prevRemaining = useRef<number | null>(null);
  const chimedFor = useRef<number | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const sync = () => {
      const t = resolveSharedTimer(conn);
      setSharedTimer(t);
      setTimerEndsAt(t?.endsAt ?? null);
    };
    conn.awareness.on('change', sync);
    sync();
    return () => conn.awareness.off('change', sync);
  }, [conn, setSharedTimer, setTimerEndsAt]);

  useEffect(() => {
    return () => {
      stopTimerMusic();
    };
  }, []);

  useEffect(() => {
    const running = isTimerRunning(sharedTimer, now);
    syncTimerMusic(running ? sharedTimer?.musicId ?? null : null, running);
  }, [sharedTimer, now]);

  useEffect(() => {
    if (!sharedTimer) {
      prevRemaining.current = null;
      return;
    }

    const remaining = Math.max(0, Math.ceil(timerRemainingMs(sharedTimer, now) / 1000));
    const runningLike = isTimerRunning(sharedTimer, now) || remaining === 0;

    if (prevRemaining.current === null) {
      prevRemaining.current = remaining;
      if (remaining === 0 && sharedTimer.endsAt != null) {
        chimedFor.current = sharedTimer.updatedAt;
      }
      return;
    }

    if (
      runningLike &&
      prevRemaining.current > 0 &&
      remaining === 0 &&
      !isTimerPaused(sharedTimer) &&
      chimedFor.current !== sharedTimer.updatedAt
    ) {
      chimedFor.current = sharedTimer.updatedAt;
      playTimerEndedChime();
      stopTimerMusic();
    }

    prevRemaining.current = remaining;
  }, [conn, now, sharedTimer, setSharedTimer, setTimerEndsAt]);

  if (!sharedTimer) return null;
  if (isTimerPaused(sharedTimer)) {
    return formatCountdown(Math.max(0, Math.ceil(timerRemainingMs(sharedTimer, now) / 1000)));
  }
  const remaining = Math.max(0, Math.ceil(timerRemainingMs(sharedTimer, now) / 1000));
  if (remaining === 0 && sharedTimer.endsAt != null) return 'Time up';
  if (!isTimerRunning(sharedTimer, now) && remaining === 0) return null;
  return formatCountdown(remaining);
}
