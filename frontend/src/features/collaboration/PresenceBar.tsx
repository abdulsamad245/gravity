import {
  AlarmClock,
  Clapperboard,
  Download,
  Ellipsis,
  History,
  Menu,
  Presentation,
  Route,
  ExternalLink,
  Phone,
  Share2,
  Upload,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Logo } from '../../shared/components/Logo';
import { OrbitIcon } from '../../shared/components/OrbitIcon';
import { TemplatesIcon } from '../../shared/components/TemplatesIcon';
import { ThemeSwitcher } from '../../shared/components/ThemeSwitcher';
import { Tooltip } from '../../shared/components/Tooltip';
import { ASSISTANT_NAME } from '../../shared/constants/app.constants';
import { MENU_MOTION_MS, MOBILE_MENU_MOTION_MS } from '../../shared/constants/motion.constants';
import { usePresence } from '../../shared/hooks/useOpenTransition';
import type { Identity } from '../../shared/types';
import { saveIdentity } from '../../shared/utils/identity';
import { CanvasBackgroundPicker } from '../canvas/CanvasBackgroundPicker';
import { FacilitationMenu, useFacilitationTimerSync } from '../facilitation/FacilitationMenu';
import { useUiStore } from '../../stores/ui.store';
import { InstallAppButton } from '../pwa/InstallAppButton';
import { BoardSwitcher } from './BoardSwitcher';
import { ProfileDialog } from './ProfileDialog';
import { ShareModal } from './ShareModal';
import type { ConnectionStatus, RoomConnection } from './RoomConnection';
import type { RemoteUser } from './useAwareness';
import { openCallUrl, useCallUrl } from './useCallUrl';
import { useWorkshopState } from './useWorkshopState';

interface Props {
  conn: RoomConnection;
  remoteUsers: RemoteUser[];
  status: ConnectionStatus;
  onExportPNG: () => void;
  onExportSVG: () => void;
  onExportJSON: () => void;
  onImportJSON: (file: File) => void;
  onOpenSessionHistory: (file: File) => void;
  onReplay: () => void;
  replayActive: boolean;
  onTemplates: () => void;
  onOrbit: () => void;
  onPresent: () => void;
  presentDisabled?: boolean;
  onTakeTour?: () => void;
}

const STATUS_LABEL: Record<ConnectionStatus, string> = {
  online: 'Online',
  offline: 'Offline. Editing locally, will sync.',
  connecting: 'Connecting…',
  reconnecting: 'Reconnecting…',
};

const MAX_VISIBLE_REMOTE_USERS = 3;
/** Avatar diameter; keep in sync with `.avatar` in styles.css */
const AVATAR_PX = 32;
/** Negative margin between stacked avatars; keep in sync with `.avatars > .tip` */
const AVATAR_OVERLAP_PX = 10;
const PRESENCE_BAR_GAP_PX = 12;

function avatarStackWidthPx(faceCount: number): number {
  if (faceCount <= 0) return 0;
  return AVATAR_PX + (faceCount - 1) * (AVATAR_PX - AVATAR_OVERLAP_PX);
}

function maxRemoteAvatarsForWidth(availablePx: number, remoteCount: number): number {
  if (remoteCount <= 0 || availablePx < AVATAR_PX) return 0;
  let max = Math.min(MAX_VISIBLE_REMOTE_USERS, remoteCount);
  while (max > 0) {
    const hidden = remoteCount - max;
    const faces = 1 + max + (hidden > 0 ? 1 : 0);
    if (avatarStackWidthPx(faces) <= availablePx) return max;
    max -= 1;
  }
  return 0;
}

export function PresenceBar({
  conn,
  remoteUsers,
  status,
  onExportPNG,
  onExportSVG,
  onExportJSON,
  onImportJSON,
  onOpenSessionHistory,
  onReplay,
  replayActive,
  onTemplates,
  onOrbit,
  onPresent,
  presentDisabled,
  onTakeTour,
}: Props) {
  const [shareOpen, setShareOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [facilOpen, setFacilOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const morePresence = usePresence(moreOpen, MENU_MOTION_MS);
  const mobileMenuPresence = usePresence(mobileMenuOpen, MOBILE_MENU_MOTION_MS);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [me, setMe] = useState<Identity>(conn.identity);
  const [narrowChrome, setNarrowChrome] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches,
  );
  const [maxVisibleRemoteUsers, setMaxVisibleRemoteUsers] = useState(MAX_VISIBLE_REMOTE_USERS);
  const barRef = useRef<HTMLElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const facilRef = useRef<HTMLDivElement>(null);
  const facilPanelRef = useRef<HTMLDivElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const mobilePanelRef = useRef<HTMLDivElement>(null);
  const participantsRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLInputElement>(null);
  const { followClientId, setFollowClientId, chromeReveal } = useUiStore();
  const timerLabel = useFacilitationTimerSync(conn);
  const { callUrl, hasCall } = useCallUrl(conn);
  const workshop = useWorkshopState(conn);
  const votingLive = workshop.voting?.status === 'active';
  const votingRevealed = workshop.voting?.status === 'revealed';
  const [voteNow, setVoteNow] = useState(Date.now());
  const votingEndsAt = workshop.voting?.status === 'active' ? workshop.voting.endsAt : undefined;
  const votingRemainSec =
    votingLive && votingEndsAt != null ? Math.max(0, Math.ceil((votingEndsAt - voteNow) / 1000)) : null;
  const votingChip = votingLive
    ? votingRemainSec != null
      ? `Voting ${String(Math.floor(votingRemainSec / 60)).padStart(2, '0')}:${String(votingRemainSec % 60).padStart(2, '0')}`
      : 'Voting'
    : votingRevealed
      ? 'Results'
      : null;

  useEffect(() => {
    if (!votingLive || votingEndsAt == null) return;
    const id = window.setInterval(() => {
      setVoteNow(Date.now());
      conn.checkVotingDeadline();
    }, 500);
    return () => clearInterval(id);
  }, [conn, votingLive, votingEndsAt]);

  const [handRaisedSelf, setHandRaisedSelf] = useState(false);
  const [handNotice, setHandNotice] = useState('');

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const sync = () => setNarrowChrome(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const bar = barRef.current;
    const left = leftRef.current;
    const right = rightRef.current;
    if (!bar || !left || !right) return;

    const peopleRowMq = window.matchMedia('(max-width: 640px)');
    const sync = () => {
      const barWidth = bar.clientWidth;
      // Below 640px people sit on their own row; budget the full bar width.
      // Above that, reserve intrinsic left/right chrome so avatars never collide.
      const available = peopleRowMq.matches
        ? barWidth
        : barWidth - left.scrollWidth - right.scrollWidth - PRESENCE_BAR_GAP_PX * 2;
      const next = maxRemoteAvatarsForWidth(Math.max(0, available), remoteUsers.length);
      setMaxVisibleRemoteUsers((prev) => (prev === next ? prev : next));
    };

    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(bar);
    ro.observe(left);
    ro.observe(right);
    peopleRowMq.addEventListener('change', sync);
    window.addEventListener('resize', sync);
    return () => {
      ro.disconnect();
      peopleRowMq.removeEventListener('change', sync);
      window.removeEventListener('resize', sync);
    };
  }, [remoteUsers.length, narrowChrome, status]);

  useEffect(() => {
    if (!chromeReveal) return;
    const { kind } = chromeReveal;
    if (kind === 'facilitate') {
      setMoreOpen(false);
      setMobileMenuOpen(false);
      setFacilOpen(true);
    } else if (kind === 'moreMenu') {
      setFacilOpen(false);
      if (narrowChrome) {
        setMobileMenuOpen(true);
        setMoreOpen(false);
      } else {
        setMoreOpen(true);
      }
    } else if (kind === 'share') {
      setShareOpen(true);
    } else if (kind === 'templates') {
      onTemplates();
    }
  }, [chromeReveal, narrowChrome, onTemplates]);

  useEffect(() => {
    const sync = () => {
      const local = conn.awareness.getLocalState() as { handRaised?: boolean } | null;
      setHandRaisedSelf(!!local?.handRaised);
      const raised = remoteUsers.filter((u) => u.state.handRaised).map((u) => u.state.user.name);
      setHandNotice(raised.length ? `Hand raised: ${raised.join(', ')}` : '');
    };
    sync();
    conn.awareness.on('change', sync);
    return () => conn.awareness.off('change', sync);
  }, [conn, remoteUsers]);

  useEffect(() => {
    if (
      !morePresence.mounted &&
      !facilOpen &&
      !mobileMenuPresence.mounted &&
      !participantsOpen
    ) {
      return;
    }
    const onDown = (e: MouseEvent) => {
      if (document.body.classList.contains('gravity-spotlight-active')) return;
      const t = e.target as Node;
      if (morePresence.mounted && moreRef.current && !moreRef.current.contains(t)) {
        setMoreOpen(false);
      }
      if (
        facilOpen &&
        !facilRef.current?.contains(t) &&
        !facilPanelRef.current?.contains(t)
      ) {
        setFacilOpen(false);
      }
      if (
        mobileMenuPresence.mounted &&
        !mobileMenuRef.current?.contains(t) &&
        !mobilePanelRef.current?.contains(t)
      ) {
        setMobileMenuOpen(false);
      }
      if (participantsOpen && participantsRef.current && !participantsRef.current.contains(t)) {
        setParticipantsOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMoreOpen(false);
        setFacilOpen(false);
        setMobileMenuOpen(false);
        setParticipantsOpen(false);
      }
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [
    morePresence.mounted,
    facilOpen,
    mobileMenuPresence.mounted,
    participantsOpen,
  ]);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const applyProfile = (next: { name: string; color: string; avatar?: string | null }) => {
    const identity = saveIdentity(next.name, next.color, next.avatar ?? null);
    Object.assign(conn.identity, identity);
    if (!identity.avatar) delete conn.identity.avatar;
    // Replace user object so a cleared photo does not linger in awareness.
    conn.setPresence({
      user: {
        name: identity.name,
        color: identity.color,
        id: identity.id,
        ...(identity.avatar ? { avatar: identity.avatar } : {}),
      },
    });
    setMe({ ...identity });
  };
  const visibleRemoteUsers = remoteUsers.slice(0, maxVisibleRemoteUsers);
  const hiddenUserCount = remoteUsers.length - visibleRemoteUsers.length;

  return (
    <header ref={barRef} className="presence-bar panel" role="banner">
      <div className="presence-left" ref={leftRef}>
        <Logo size={30} className="presence-brand presence-brand-desktop" />
        <Logo size={32} showWordmark={false} className="presence-brand presence-brand-mobile" />
        <BoardSwitcher conn={conn} />
        <Tooltip label={STATUS_LABEL[status]} side="bottom">
          <span className={`status-dot status-${status}`} aria-label={STATUS_LABEL[status]} />
        </Tooltip>
        {(status === 'reconnecting' || status === 'connecting' || status === 'offline') && (
          <span className={`presence-conn-text status-text-${status}`} role="status" aria-live="polite">
            {status === 'offline' ? 'Offline' : STATUS_LABEL[status]}
          </span>
        )}
        <Tooltip label="Templates">
          <button
            type="button"
            className="btn btn-ghost icon-btn"
            data-tour="templates"
            onClick={onTemplates}
            aria-label="Templates"
          >
            <TemplatesIcon size={18} />
          </button>
        </Tooltip>
      </div>

      <div className="presence-center" ref={participantsRef} data-tour="people">
        <div className="avatars" role="group" aria-label="People in this room">
          <Tooltip label={`${me.name} (you). Click to edit name and avatar.`} side="bottom">
            <button
              type="button"
              className={`avatar ${handRaisedSelf ? 'hand-raised' : ''}`}
              style={{ background: me.color }}
              aria-label={`${me.name}, edit profile${handRaisedSelf ? ', hand raised' : ''}`}
              onClick={() => setProfileOpen(true)}
            >
              {me.avatar ? <img src={me.avatar} alt="" className="avatar-photo" /> : initials(me.name)}
              {handRaisedSelf && (
                <span className="avatar-hand" aria-hidden>
                  ✋
                </span>
              )}
            </button>
          </Tooltip>
          {visibleRemoteUsers.map(({ clientId, state }) => (
            <Tooltip
              key={clientId}
              label={
                followClientId === clientId
                  ? `Following ${state.user.name}. Click to stop.`
                  : `${state.user.name}${state.handRaised ? ' (hand raised)' : ''}. Click to follow their view.`
              }
              side="bottom"
            >
              <button
                type="button"
                className={`avatar ${followClientId === clientId ? 'following' : ''} ${state.handRaised ? 'hand-raised' : ''}`}
                style={{ background: state.user.color }}
                aria-label={
                  followClientId === clientId
                    ? `Stop following ${state.user.name}`
                    : `Follow ${state.user.name}${state.handRaised ? ', hand raised' : ''}`
                }
                onClick={() => setFollowClientId(followClientId === clientId ? null : clientId)}
              >
                {state.user.avatar ? (
                  <img src={state.user.avatar} alt="" className="avatar-photo" />
                ) : (
                  initials(state.user.name)
                )}
                {state.handRaised && (
                  <span className="avatar-hand" aria-hidden>
                    ✋
                  </span>
                )}
              </button>
            </Tooltip>
          ))}
          {hiddenUserCount > 0 && (
            <button
              type="button"
              className="avatar avatar-more"
              aria-label={`Show ${hiddenUserCount} more ${hiddenUserCount === 1 ? 'person' : 'people'}`}
              aria-expanded={participantsOpen}
              onClick={() => setParticipantsOpen((open) => !open)}
            >
              +{hiddenUserCount}
            </button>
          )}
        </div>
        <span className="sr-only" aria-live="polite">
          {handNotice}
        </span>
        {participantsOpen && (
          <div className="participants-popover panel" role="dialog" aria-label="People in this room">
            <strong>People in this room</strong>
            <div className="participant-row">
              <span className="participant-avatar" style={{ background: me.color }}>
                {me.avatar ? <img src={me.avatar} alt="" className="avatar-photo" /> : initials(me.name)}
              </span>
              <span className="participant-details">
                <b>{me.name}</b>
                <small>You</small>
              </span>
            </div>
            {remoteUsers.map(({ clientId, state }) => (
              <button
                key={clientId}
                type="button"
                className={`participant-row participant-action ${followClientId === clientId ? 'following' : ''}`}
                onClick={() => {
                  setFollowClientId(followClientId === clientId ? null : clientId);
                  setParticipantsOpen(false);
                }}
              >
                <span className="participant-avatar" style={{ background: state.user.color }}>
                  {state.user.avatar ? (
                    <img src={state.user.avatar} alt="" className="avatar-photo" />
                  ) : (
                    initials(state.user.name)
                  )}
                </span>
                <span className="participant-details">
                  <b>{state.user.name}</b>
                  <small>
                    {followClientId === clientId
                      ? 'Following, click to stop'
                      : state.handRaised
                        ? 'Hand raised, click to follow'
                        : 'Click to follow'}
                  </small>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="presence-right" ref={rightRef}>
        {/* Own profile control; closed by default on all breakpoints. */}
        <div className="export-menu presence-facil-trigger" ref={facilRef}>
          <Tooltip
            label={
              timerLabel
                ? `Shared countdown ${timerLabel}`
                : votingLive
                  ? `Voting live: ${workshop.voting?.prompt ?? 'cast votes on board objects'}`
                  : votingRevealed
                    ? 'Vote results are on the board'
                    : 'Workshop tools: timer, voting, reactions, board physics'
            }
          >
            <button
              type="button"
              className={`btn btn-ghost icon-btn ${facilOpen || timerLabel || votingChip ? 'active-soft' : ''}`}
              data-tour="facilitate"
              onClick={() => {
                setMoreOpen(false);
                setMobileMenuOpen(false);
                setFacilOpen((v) => !v);
              }}
              aria-expanded={facilOpen}
              aria-label="Workshop tools"
            >
              <AlarmClock size={18} strokeWidth={2} />
              {timerLabel && (
                <span className={`timer-chip${timerLabel === 'Time up' ? ' timer-chip-ended' : ''}`}>
                  {timerLabel}
                </span>
              )}
              {!timerLabel && votingChip && (
                <span className={`timer-chip${votingLive ? ' timer-chip-vote' : ''}`}>{votingChip}</span>
              )}
            </button>
          </Tooltip>
          {facilOpen &&
            (narrowChrome
              ? createPortal(
                  <div
                    ref={facilPanelRef}
                    className="export-dropdown panel presence-facil presence-facil-sheet"
                  >
                    <FacilitationMenu
                      compact
                      conn={conn}
                      onClose={() => setFacilOpen(false)}
                    />
                  </div>,
                  document.body,
                )
              : (
                  <div ref={facilPanelRef} className="export-dropdown panel presence-facil">
                    <FacilitationMenu conn={conn} onClose={() => setFacilOpen(false)} />
                  </div>
                ))}
        </div>

        <div className="presence-desktop-actions">
          <Tooltip label={ASSISTANT_NAME}>
            <button
              type="button"
              className="btn btn-ghost icon-btn"
              data-tour="orbit"
              onClick={onOrbit}
              aria-label={ASSISTANT_NAME}
            >
              <OrbitIcon size={18} />
            </button>
          </Tooltip>
          <Tooltip
            label={
              presentDisabled
                ? 'Add frames to the board to present'
                : 'Present frames as slides'
            }
          >
            <button
              type="button"
              className="btn btn-ghost icon-btn"
              data-tour="present"
              onClick={onPresent}
              disabled={presentDisabled || replayActive}
              aria-label="Present frames as slides"
            >
              <Presentation size={18} strokeWidth={2} />
            </button>
          </Tooltip>
          <Tooltip label="Watch how this board was built, step by step">
            <button
              type="button"
              className="btn btn-ghost icon-btn"
              data-tour="replay"
              onClick={onReplay}
              disabled={replayActive}
              aria-label="Watch how this board was built, step by step"
            >
              <Clapperboard size={18} strokeWidth={2} />
            </button>
          </Tooltip>

          <div className="export-menu" ref={moreRef}>
            <Tooltip label={moreOpen ? '' : 'More'}>
              <button
                type="button"
                className="btn btn-ghost icon-btn"
                data-tour="more"
                onClick={() => {
                  setFacilOpen(false);
                  setMoreOpen((v) => !v);
                }}
                aria-expanded={moreOpen}
                aria-label="More actions"
              >
                <Ellipsis size={18} strokeWidth={2} />
              </button>
            </Tooltip>
            {morePresence.mounted && (
              <div
                className={`export-dropdown panel presence-more ${morePresence.className}`}
                role="menu"
              >
                {onTakeTour && (
                  <button
                    type="button"
                    className="tool-flyout-item"
                    role="menuitem"
                    aria-label="Take a tour of the board"
                    onClick={() => {
                      setMoreOpen(false);
                      onTakeTour();
                    }}
                  >
                    <Route size={16} aria-hidden /> Take a tour
                  </button>
                )}
                <InstallAppButton onAfterAction={() => setMoreOpen(false)} />
                <div className="context-sep" />
                <div className="more-section">
                  <span className="more-label">Board</span>
                  <button
                    type="button"
                    className="tool-flyout-item"
                    role="menuitem"
                    aria-label="Import board from JSON"
                    onClick={() => {
                      importRef.current?.click();
                      setMoreOpen(false);
                    }}
                  >
                    <Upload size={16} aria-hidden /> Import board
                  </button>
                  <button
                    type="button"
                    className="tool-flyout-item"
                    role="menuitem"
                    aria-label="Open saved session history"
                    disabled={replayActive}
                    onClick={() => {
                      historyRef.current?.click();
                      setMoreOpen(false);
                    }}
                  >
                    <History size={16} aria-hidden /> Open session history
                  </button>
                </div>
                <div className="more-section">
                  <span className="more-label">Export</span>
                  <div className="more-export-row" role="group" aria-label="Export board">
                    <button
                      type="button"
                      className="more-export-chip"
                      aria-label="Download PNG"
                      onClick={() => {
                        onExportPNG();
                        setMoreOpen(false);
                      }}
                    >
                      <Download size={14} strokeWidth={2.25} aria-hidden />
                      PNG
                    </button>
                    <button
                      type="button"
                      className="more-export-chip"
                      aria-label="Download SVG"
                      onClick={() => {
                        onExportSVG();
                        setMoreOpen(false);
                      }}
                    >
                      <Download size={14} strokeWidth={2.25} aria-hidden />
                      SVG
                    </button>
                    <button
                      type="button"
                      className="more-export-chip"
                      aria-label="Download JSON"
                      onClick={() => {
                        onExportJSON();
                        setMoreOpen(false);
                      }}
                    >
                      <Download size={14} strokeWidth={2.25} aria-hidden />
                      JSON
                    </button>
                  </div>
                </div>
                <div className="context-sep" />
                <div className="more-section more-section-theme">
                  <span className="more-label">Theme</span>
                  <ThemeSwitcher compact stretch />
                </div>
                <div className="more-section">
                  <CanvasBackgroundPicker onPicked={() => setMoreOpen(false)} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="presence-mobile-menu" ref={mobileMenuRef}>
          <Tooltip label={mobileMenuOpen ? '' : 'Menu'}>
            <button
              type="button"
              className={`btn btn-ghost icon-btn ${mobileMenuOpen ? 'active-soft' : ''}`}
              data-tour="menu"
              aria-expanded={mobileMenuOpen}
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
              onClick={() => {
                setFacilOpen(false);
                setMoreOpen(false);
                setMobileMenuOpen((v) => !v);
              }}
            >
              {mobileMenuOpen ? <X size={18} strokeWidth={2} /> : <Menu size={18} strokeWidth={2} />}
            </button>
          </Tooltip>
          {mobileMenuPresence.mounted &&
            createPortal(
            <>
            <button
              type="button"
              className={`presence-mobile-scrim ${mobileMenuPresence.className}`}
              aria-label="Close menu"
              tabIndex={-1}
              onClick={closeMobileMenu}
            />
            <div
              ref={mobilePanelRef}
              className={`export-dropdown panel presence-mobile-panel ${mobileMenuPresence.className}`}
              role="menu"
            >
              <div className="more-section">
                <span className="more-label">Room</span>
                <button
                  type="button"
                  className={`tool-flyout-item${!hasCall ? ' is-disabled' : ''}`}
                  role="menuitem"
                  disabled={!hasCall}
                  aria-disabled={!hasCall}
                  aria-label={
                    hasCall ? 'Join call' : 'Join call unavailable: no call link configured'
                  }
                  title={
                    hasCall
                      ? 'Open call in a new tab'
                      : 'No call link yet. Ask the room creator to add one in Share'
                  }
                  onClick={() => {
                    if (!hasCall) return;
                    openCallUrl(callUrl);
                    closeMobileMenu();
                  }}
                >
                  <Phone size={16} aria-hidden /> Call
                </button>
                <button
                  type="button"
                  className="tool-flyout-item"
                  role="menuitem"
                  onClick={() => {
                    setShareOpen(true);
                    closeMobileMenu();
                  }}
                >
                  <Share2 size={16} aria-hidden /> Share
                </button>
                <button
                  type="button"
                  className="tool-flyout-item"
                  role="menuitem"
                  onClick={() => {
                    onTemplates();
                    closeMobileMenu();
                  }}
                >
                  <TemplatesIcon size={16} /> Templates
                </button>
              </div>
              <div className="more-section">
                <span className="more-label">Tools</span>
                {onTakeTour && (
                  <button
                    type="button"
                    className="tool-flyout-item"
                    role="menuitem"
                    aria-label="Take a tour of the board"
                    onClick={() => {
                      closeMobileMenu();
                      onTakeTour();
                    }}
                  >
                    <Route size={16} aria-hidden /> Take a tour
                  </button>
                )}
                <InstallAppButton onAfterAction={closeMobileMenu} />
                <button
                  type="button"
                  className="tool-flyout-item"
                  role="menuitem"
                  onClick={() => {
                    onOrbit();
                    closeMobileMenu();
                  }}
                >
                  <OrbitIcon size={16} /> {ASSISTANT_NAME}
                </button>
                <button
                  type="button"
                  className="tool-flyout-item"
                  role="menuitem"
                  disabled={presentDisabled || replayActive}
                  onClick={() => {
                    onPresent();
                    closeMobileMenu();
                  }}
                >
                  <Presentation size={16} aria-hidden /> Present
                </button>
                <button
                  type="button"
                  className="tool-flyout-item"
                  role="menuitem"
                  disabled={replayActive}
                  onClick={() => {
                    onReplay();
                    closeMobileMenu();
                  }}
                >
                  <Clapperboard size={16} aria-hidden /> Replay
                </button>
              </div>
              <div className="more-section">
                <span className="more-label">Board</span>
                <button
                  type="button"
                  className="tool-flyout-item"
                  role="menuitem"
                  aria-label="Import board from JSON"
                  onClick={() => {
                    importRef.current?.click();
                    closeMobileMenu();
                  }}
                >
                  <Upload size={16} aria-hidden /> Import board
                </button>
                <button
                  type="button"
                  className="tool-flyout-item"
                  role="menuitem"
                  aria-label="Open saved session history"
                  disabled={replayActive}
                  onClick={() => {
                    historyRef.current?.click();
                    closeMobileMenu();
                  }}
                >
                  <History size={16} aria-hidden /> Open session history
                </button>
              </div>
              <div className="more-section">
                <span className="more-label">Export</span>
                <div className="more-export-row" role="group" aria-label="Export board">
                  <button
                    type="button"
                    className="more-export-chip"
                    aria-label="Download PNG"
                    onClick={() => {
                      onExportPNG();
                      closeMobileMenu();
                    }}
                  >
                    <Download size={14} strokeWidth={2.25} aria-hidden />
                    PNG
                  </button>
                  <button
                    type="button"
                    className="more-export-chip"
                    aria-label="Download SVG"
                    onClick={() => {
                      onExportSVG();
                      closeMobileMenu();
                    }}
                  >
                    <Download size={14} strokeWidth={2.25} aria-hidden />
                    SVG
                  </button>
                  <button
                    type="button"
                    className="more-export-chip"
                    aria-label="Download JSON"
                    onClick={() => {
                      onExportJSON();
                      closeMobileMenu();
                    }}
                  >
                    <Download size={14} strokeWidth={2.25} aria-hidden />
                    JSON
                  </button>
                </div>
              </div>
              <div className="more-section more-section-theme">
                <span className="more-label">Theme</span>
                <ThemeSwitcher compact stretch />
              </div>
              <div className="more-section">
                <CanvasBackgroundPicker onPicked={closeMobileMenu} />
              </div>
            </div>
            </>,
            document.body,
          )}
        </div>

        <Tooltip
          label={
            hasCall
              ? 'Open call in a new tab'
              : 'No call link yet. The room creator can add one in Share'
          }
        >
          <button
            type="button"
            className={`btn btn-ghost presence-join-call${hasCall ? '' : ' is-disabled'}`}
            disabled={!hasCall}
            aria-disabled={!hasCall}
            aria-label={
              hasCall ? 'Join call' : 'Join call unavailable: no call link configured'
            }
            onClick={() => {
              if (!hasCall) return;
              openCallUrl(callUrl);
            }}
          >
            <Phone size={16} aria-hidden />
            <span className="presence-join-call-label">Join call</span>
            <ExternalLink size={14} aria-hidden />
          </button>
        </Tooltip>

        <Tooltip label="Share room">
          <button
            type="button"
            className="btn btn-share"
            data-tour="share"
            onClick={() => setShareOpen(true)}
          >
            Share
          </button>
        </Tooltip>

        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImportJSON(file);
            e.target.value = '';
          }}
        />
        <input
          ref={historyRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onOpenSessionHistory(file);
            e.target.value = '';
          }}
        />

        {shareOpen && <ShareModal conn={conn} onClose={() => setShareOpen(false)} />}
      </div>

      {profileOpen && (
        <ProfileDialog identity={me} onClose={() => setProfileOpen(false)} onSave={applyProfile} />
      )}
    </header>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
