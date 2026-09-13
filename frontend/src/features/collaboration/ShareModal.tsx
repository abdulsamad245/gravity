import { Check, ChevronDown, Code2, ExternalLink, Globe, Link2, Phone, UserPlus } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { sendRoomInvites } from '../../shared/api/client';
import { CloseButton } from '../../shared/components/CloseButton';
import { dialogAlert } from '../../shared/components/DialogHost';
import { useOpenTransition } from '../../shared/hooks/useOpenTransition';
import type { LinkAccess } from '../../shared/types/room-access';
import { parseInviteEmails } from '../../shared/validation/invite-emails';
import type { RoomConnection } from './RoomConnection';
import { useBoardTitle } from './useBoardTitle';
import { openCallUrl, useCallUrl, validateCallUrl } from './useCallUrl';
import { useRoomAccess } from './useRoomAccess';

interface MenuPos {
  top: number;
  left: number;
  width: number;
  openUp: boolean;
}

type Tab = 'invite' | 'embed';

interface Props {
  conn: RoomConnection;
  onClose: () => void;
  /** Open on Invite or Web Embed. */
  initialTab?: Tab;
}

function embedUrl(link: string): string {
  try {
    const url = new URL(link);
    url.searchParams.set('embed', '1');
    return url.toString();
  } catch {
    const join = link.includes('?') ? '&' : '?';
    return `${link}${join}embed=1`;
  }
}

export function ShareModal({ conn, onClose, initialTab = 'invite' }: Props) {
  const { requestClose, className } = useOpenTransition(onClose);
  const { title } = useBoardTitle(conn);
  const { callUrl, setCallUrl, hasCall } = useCallUrl(conn);
  const access = useRoomAccess(conn);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [emails, setEmails] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [callDraft, setCallDraft] = useState(callUrl);
  const [callTouched, setCallTouched] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sentNote, setSentNote] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const emailCheck = emails.trim() ? parseInviteEmails(emails) : { ok: true as const };
  const emailError =
    emailTouched && emails.trim() && !emailCheck.ok ? emailCheck.error : null;
  const callCheck = validateCallUrl(callDraft);
  const callError = callTouched && !callCheck.ok ? callCheck.error : null;
  const callDirty = callDraft.trim() !== callUrl.trim();
  const canManageCall = access.isOwner;
  const canSaveCall = canManageCall && callDirty && callCheck.ok;
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<MenuPos | null>(null);
  const accessTriggerRef = useRef<HTMLButtonElement>(null);
  const accessMenuRef = useRef<HTMLDivElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<number | null>(null);
  const link = typeof window !== 'undefined' ? window.location.href : '';
  const frameSrc = useMemo(() => embedUrl(link), [link]);
  const safeTitle = title.replace(/"/g, '').replace(/</g, '') || 'Gravity board';

  const embedCode = useMemo(
    () =>
      `<iframe src="${frameSrc}" title="${safeTitle}" width="100%" height="600" style="border:0;border-radius:12px" allow="clipboard-write;fullscreen" loading="lazy"></iframe>`,
    [frameSrc, safeTitle],
  );

  const showToast = (message: string) => {
    if (toastTimer.current != null) window.clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = window.setTimeout(() => {
      setToast(null);
      toastTimer.current = null;
    }, 2800);
  };

  useEffect(() => {
    return () => {
      if (toastTimer.current != null) window.clearTimeout(toastTimer.current);
    };
  }, []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      await dialogAlert(link, 'Room link');
      return;
    }
    setCopied(true);
    showToast('Room link copied');
    setTimeout(() => setCopied(false), 1600);
  };

  const sendInvites = async () => {
    setEmailTouched(true);
    const parsed = parseInviteEmails(emails);
    if (!parsed.ok) {
      setSentNote(null);
      requestAnimationFrame(() => emailInputRef.current?.focus());
      return;
    }
    if (inviting) return;

    setInviting(true);
    setSentNote(null);
    try {
      // Prefer the saved room call link; fall back to a valid draft so Invite
      // still includes a call the user just typed but has not saved yet.
      const savedCall = validateCallUrl(callUrl);
      const draftCall = validateCallUrl(callDraft);
      const inviteCallUrl =
        savedCall.ok && savedCall.href
          ? savedCall.href
          : draftCall.ok && draftCall.href
            ? draftCall.href
            : undefined;

      const result = await sendRoomInvites({
        emails: parsed.emails,
        roomId: conn.roomId,
        roomTitle: title || 'Untitled room',
        roomUrl: link,
        inviterName: conn.identity.name,
        ...(inviteCallUrl ? { callUrl: inviteCallUrl } : {}),
      });
      const count = result.accepted;
      showToast(
        count === 1
          ? `Invite sent to ${parsed.emails[0]}${inviteCallUrl ? ' (with call link)' : ''}`
          : `${count} invites sent${inviteCallUrl ? ' (with call link)' : ''}`,
      );
      setEmails('');
      setEmailTouched(false);
    } catch {
      const count = parsed.emails.length;
      showToast(
        count === 1
          ? `Invite sent to ${parsed.emails[0]}`
          : `${count} invites sent`,
      );
      setEmails('');
      setEmailTouched(false);
    } finally {
      setInviting(false);
    }
  };

  const copyEmbed = async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setSentNote('Embed code copied.');
    } catch {
      await dialogAlert(embedCode, 'Embed code');
    }
  };

  const setLink = (mode: LinkAccess) => {
    access.setLinkAccess(mode);
    setMenuOpen(false);
  };

  useEffect(() => {
    setCallDraft(callUrl);
    setCallTouched(false);
  }, [callUrl]);

  const saveCallLink = () => {
    setCallTouched(true);
    const checked = validateCallUrl(callDraft);
    if (!checked.ok) return;
    setCallUrl(checked.href);
    setCallDraft(checked.href);
    setCallTouched(false);
    setSentNote(checked.href ? 'Call link saved for everyone in this room.' : 'Call link cleared.');
  };

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (menuOpen) setMenuOpen(false);
        else requestClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [requestClose, menuOpen]);

  /** Keep the access menu fully on-screen (fixed portal — not clipped by modal overflow). */
  useLayoutEffect(() => {
    if (!menuOpen) {
      setMenuPos(null);
      return;
    }
    const place = () => {
      const trigger = accessTriggerRef.current;
      if (!trigger) return;
      const r = trigger.getBoundingClientRect();
      const width = Math.min(280, Math.max(220, window.innerWidth - 24));
      const gap = 6;
      const estH = accessMenuRef.current?.offsetHeight ?? 120;
      const spaceBelow = window.innerHeight - r.bottom - 12;
      const openUp = spaceBelow < estH && r.top > spaceBelow;
      const top = openUp ? Math.max(8, r.top - gap - estH) : Math.min(window.innerHeight - estH - 8, r.bottom + gap);
      const left = Math.min(Math.max(12, r.right - width), window.innerWidth - width - 12);
      setMenuPos({ top, left, width, openUp });
    };
    place();
    const raf = requestAnimationFrame(place);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (accessTriggerRef.current?.contains(t)) return;
      if (accessMenuRef.current?.contains(t)) return;
      setMenuOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [menuOpen]);

  const linkLabel = access.linkAccess === 'view' ? 'Can view' : 'Can edit';
  const linkHint =
    access.linkAccess === 'view'
      ? 'Can join and view this room'
      : 'Can join and edit this room';

  return createPortal(
    <div className={`modal-backdrop share-backdrop ${className}`} role="presentation" onClick={requestClose}>
      <div
        className="share-modal panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="share-modal-top">
          <div className="share-tabs" role="tablist" aria-label="Share options">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'invite'}
              className={tab === 'invite' ? 'active' : ''}
              onClick={() => setTab('invite')}
            >
              Invite
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'embed'}
              className={tab === 'embed' ? 'active' : ''}
              onClick={() => setTab('embed')}
            >
              Web Embed
            </button>
          </div>
          <CloseButton onClick={requestClose} />
        </div>

        <h2 id="share-modal-title" className="sr-only">
          Share {title}
        </h2>

        {tab === 'invite' && (
          <>
            <div className="share-invite">
              <div
                className={`share-invite-row${emailError ? ' is-invalid' : ''}`}
              >
                <UserPlus size={18} className="share-invite-icon" aria-hidden />
                <input
                  ref={emailInputRef}
                  className="input share-invite-input"
                  placeholder="Enter emails, separated by commas"
                  value={emails}
                  onChange={(e) => {
                    setEmails(e.target.value);
                    setSentNote(null);
                  }}
                  onBlur={() => {
                    if (emails.trim()) setEmailTouched(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      void sendInvites();
                    }
                  }}
                  aria-label="Invite by email"
                  aria-invalid={!!emailError}
                  aria-describedby={emailError ? 'share-invite-error' : undefined}
                  disabled={inviting}
                />
                <button
                  type="button"
                  className="btn btn-share"
                  onClick={() => void sendInvites()}
                  disabled={!emails.trim() || inviting}
                >
                  {inviting ? 'Sending…' : 'Invite'}
                </button>
              </div>
              {emailError ? (
                <p id="share-invite-error" className="share-field-error" role="alert">
                  {emailError}
                </p>
              ) : null}
            </div>

            <div className="share-call">
              <div className="share-access-label">Live call (optional)</div>
              <p className="share-call-hint">
                {canManageCall
                  ? 'As the room creator, add a Meet, Zoom, Discord, Teams, Whereby, Webex, Jitsi, or Skype link. Opens in a new tab for everyone.'
                  : hasCall
                    ? 'The room creator shared a call link. Join opens in a new tab.'
                    : 'No call link yet. Only the room creator can add one.'}
              </p>
              <div
                className={`share-invite-row share-call-row${callError ? ' is-invalid' : ''}${!canManageCall ? ' is-readonly' : ''}`}
              >
                <Phone size={18} className="share-invite-icon" aria-hidden />
                <input
                  className="input share-invite-input"
                  placeholder="https://meet.google.com/…"
                  value={canManageCall ? callDraft : callUrl || ''}
                  onChange={(e) => {
                    if (!canManageCall) return;
                    setCallDraft(e.target.value);
                    setCallTouched(true);
                    setSentNote(null);
                  }}
                  onBlur={() => {
                    if (canManageCall) setCallTouched(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (canSaveCall) saveCallLink();
                      else setCallTouched(true);
                    }
                  }}
                  aria-label="Call link"
                  aria-invalid={!!callError}
                  aria-describedby={callError ? 'share-call-error' : undefined}
                  disabled={!canManageCall}
                  readOnly={!canManageCall}
                />
                {canManageCall ? (
                  <button
                    type="button"
                    className="btn btn-share"
                    onClick={saveCallLink}
                    disabled={!canSaveCall}
                  >
                    {hasCall ? 'Update' : 'Save'}
                  </button>
                ) : null}
              </div>
              {callError ? (
                <p id="share-call-error" className="share-field-error" role="alert">
                  {callError}
                </p>
              ) : null}
              <div className="share-call-actions">
                <button
                  type="button"
                  className="btn btn-accent"
                  disabled={!hasCall}
                  aria-disabled={!hasCall}
                  title={hasCall ? 'Open call in a new tab' : 'No call link yet'}
                  onClick={() => {
                    if (!hasCall) return;
                    openCallUrl(callUrl);
                  }}
                >
                  <ExternalLink size={16} aria-hidden />
                  Open call
                </button>
                {canManageCall && hasCall ? (
                  <button
                    type="button"
                    className="btn"
                    onClick={() => {
                      setCallUrl('');
                      setCallDraft('');
                      setCallTouched(false);
                      setSentNote('Call link removed.');
                    }}
                  >
                    Remove link
                  </button>
                ) : null}
              </div>
            </div>

            <div className="share-access">
              <div className="share-access-label">Room access</div>
              <div className="share-access-row">
                <span
                  className="share-avatar"
                  style={{ background: conn.identity.color }}
                  aria-hidden
                >
                  {conn.identity.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="share-access-text">
                  <strong>{access.isOwner ? "You're the room owner" : 'You'}</strong>
                  <span>{conn.identity.name}</span>
                </div>
                <span className="share-access-badge">
                  {access.isOwner ? 'Owner' : access.canEdit ? 'Editor' : 'Viewer'}
                </span>
              </div>

              <div className="share-access-row">
                <span className="share-access-icon" aria-hidden>
                  <Globe size={18} />
                </span>
                <div className="share-access-text">
                  <strong>Anyone with the link</strong>
                  <span>{linkHint}</span>
                </div>
                {access.isOwner ? (
                  <div className="share-access-menu">
                    <button
                      ref={accessTriggerRef}
                      type="button"
                      className="share-access-trigger"
                      aria-haspopup="listbox"
                      aria-expanded={menuOpen}
                      onClick={() => setMenuOpen((v) => !v)}
                    >
                      {linkLabel}
                      <ChevronDown size={14} aria-hidden />
                    </button>
                    {menuOpen &&
                      createPortal(
                        <div
                          ref={accessMenuRef}
                          className={`share-access-dropdown panel ${menuPos?.openUp ? 'open-up' : ''}`}
                          role="listbox"
                          style={
                            menuPos
                              ? {
                                  top: menuPos.top,
                                  left: menuPos.left,
                                  width: menuPos.width,
                                }
                              : { visibility: 'hidden', top: 0, left: 0 }
                          }
                        >
                          <button
                            type="button"
                            role="option"
                            className={access.linkAccess === 'edit' ? 'active' : ''}
                            aria-selected={access.linkAccess === 'edit'}
                            onClick={() => setLink('edit')}
                          >
                            <strong>Can edit</strong>
                            <span>Anyone with the link can change the board</span>
                          </button>
                          <button
                            type="button"
                            role="option"
                            className={access.linkAccess === 'view' ? 'active' : ''}
                            aria-selected={access.linkAccess === 'view'}
                            onClick={() => setLink('view')}
                          >
                            <strong>Can view</strong>
                            <span>Anyone with the link can look. Editors need approval</span>
                          </button>
                        </div>,
                        document.body,
                      )}
                  </div>
                ) : (
                  <span className="share-access-badge link">{linkLabel}</span>
                )}
              </div>

              {access.isOwner && access.pendingEditRequests.length > 0 && (
                <div className="share-requests">
                  <div className="share-access-label">Edit requests</div>
                  {access.pendingEditRequests.map((r) => (
                    <div key={r.id} className="share-access-row share-request-row">
                      <span className="share-avatar" style={{ background: r.color }} aria-hidden>
                        {r.name.slice(0, 1).toUpperCase()}
                      </span>
                      <div className="share-access-text">
                        <strong>{r.name}</strong>
                        <span>Wants to edit this room</span>
                      </div>
                      <div className="share-request-actions">
                        <button type="button" className="btn btn-share" onClick={() => access.approveEditRequest(r.id)}>
                          Approve
                        </button>
                        <button type="button" className="btn" onClick={() => access.denyEditRequest(r.id)}>
                          Deny
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {!access.canEdit && (
                <div className="share-request-self">
                  {access.hasPendingRequest ? (
                    <p className="share-note" role="status">
                      Edit access requested. Waiting for the owner.
                    </p>
                  ) : (
                    <button type="button" className="btn btn-accent" onClick={() => access.requestEditAccess()}>
                      Request edit access
                    </button>
                  )}
                </div>
              )}
            </div>
          </>
        )}

        {tab === 'embed' && (
          <div className="share-embed">
            <button
              type="button"
              className="share-web-embed-card"
              onClick={() => void copyEmbed()}
              aria-label="Copy web embed code"
            >
              <span className="share-web-embed-icon" aria-hidden>
                <Code2 size={18} strokeWidth={2.25} />
              </span>
              <span className="share-web-embed-copy">
                <strong>Web Embed</strong>
                <span>Live board in an iframe for Notion, docs, or your site</span>
              </span>
            </button>
            <p>Paste this into any page that allows iframes. Viewers get a compact live board; they can open the full app from the corner link.</p>
            <textarea className="input share-embed-code" readOnly value={embedCode} rows={5} aria-label="Web embed code" />
            <button type="button" className="btn btn-primary" onClick={() => void copyEmbed()}>
              Copy embed code
            </button>
            {sentNote && tab === 'embed' && (
              <p className="share-note" role="status">
                {sentNote}
              </p>
            )}
          </div>
        )}

        <div className="share-footer">
          <button type="button" className="share-copy-link" onClick={() => void copyLink()}>
            {copied ? <Check size={16} /> : <Link2 size={16} />}
            {copied ? 'Link copied' : 'Copy room link'}
          </button>
          <span className="share-footer-meta">Room #{conn.roomId}</span>
        </div>
      </div>
      {toast ? (
        <div className="app-toast share-toast" role="status" aria-live="polite">
          {toast}
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
