import { Check, MessageCircle, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { OBJECT_ID_LENGTH } from '../../shared/constants/canvas.constants';
import { EmojiPicker } from '../../shared/components/EmojiPicker';
import type { CanvasComment, CanvasObject, CommentDraft, CommentMessage } from '../../shared/types';
import { formatRelativeTime } from '../../shared/utils/relative-time';
import { insertIntoTextarea } from '../../shared/utils/textarea-insert';
import { useUiStore } from '../../stores/ui.store';
import { useViewStore } from '../../stores/view.store';
import type { RoomConnection } from '../collaboration/RoomConnection';

interface Props {
  conn: RoomConnection;
  comments: Record<string, CanvasComment>;
  objects: Record<string, CanvasObject>;
}

function pinWorld(
  comment: Pick<CanvasComment, 'x' | 'y' | 'ox' | 'oy' | 'targetId'>,
  objects: Record<string, CanvasObject>,
): { x: number; y: number } {
  if (comment.targetId) {
    const obj = objects[comment.targetId];
    if (obj) return { x: obj.x + comment.ox, y: obj.y + comment.oy };
  }
  return { x: comment.x, y: comment.y };
}

function initialOf(name: string): string {
  const t = name.trim();
  return (t[0] ?? '?').toUpperCase();
}

export function CommentsLayer({ conn, comments, objects }: Props) {
  const view = useViewStore();
  const activeCommentId = useUiStore((s) => s.activeCommentId);
  const commentDraft = useUiStore((s) => s.commentDraft);
  const setActiveCommentId = useUiStore((s) => s.setActiveCommentId);
  const setCommentDraft = useUiStore((s) => s.setCommentDraft);
  const [, tick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (commentDraft) setCommentDraft(null);
      else if (activeCommentId) setActiveCommentId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeCommentId, commentDraft, setActiveCommentId, setCommentDraft]);

  const list = useMemo(() => Object.values(comments), [comments]);

  return (
    <div className="comments-layer" aria-label="Comments">
      {list.map((c) => {
        const world = pinWorld(c, objects);
        const left = world.x * view.scale + view.x;
        const top = world.y * view.scale + view.y;
        const author = c.messages[0];
        const open = activeCommentId === c.id;
        return (
          <div key={c.id} className="comment-anchor" style={{ left, top }}>
            <button
              type="button"
              className={`comment-pin ${c.resolved ? 'resolved' : ''} ${open ? 'open' : ''}`}
              aria-label={c.resolved ? 'Resolved comment' : 'Open comment'}
              aria-expanded={open}
              onClick={(e) => {
                e.stopPropagation();
                setActiveCommentId(open ? null : c.id);
              }}
            >
              <span className="comment-pin-face" style={{ background: author?.authorColor ?? '#ff7eb6' }}>
                {author ? initialOf(author.authorName) : <MessageCircle size={14} strokeWidth={2.2} />}
              </span>
            </button>
            {open && (
              <CommentCard
                conn={conn}
                comment={c}
                onClose={() => setActiveCommentId(null)}
              />
            )}
          </div>
        );
      })}

      {commentDraft && (
        <div
          className="comment-anchor"
          style={{
            left: pinWorld(commentDraft, objects).x * view.scale + view.x,
            top: pinWorld(commentDraft, objects).y * view.scale + view.y,
          }}
        >
          <button type="button" className="comment-pin open draft" aria-label="New comment">
            <span className="comment-pin-face" style={{ background: conn.identity.color }}>
              {initialOf(conn.identity.name)}
            </span>
          </button>
          <DraftCard
            conn={conn}
            draft={commentDraft}
            onCancel={() => setCommentDraft(null)}
            onPosted={(id) => {
              setCommentDraft(null);
              setActiveCommentId(id);
            }}
          />
        </div>
      )}
    </div>
  );
}

function CommentCard({
  conn,
  comment,
  onClose,
}: {
  conn: RoomConnection;
  comment: CanvasComment;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [comment.id]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (cardRef.current?.contains(t)) return;
      if ((e.target as HTMLElement).closest?.('.comment-pin')) return;
      onClose();
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [onClose]);

  const post = () => {
    const body = text.trim();
    if (!body) return;
    const msg: CommentMessage = {
      id: nanoid(8),
      authorId: conn.identity.id,
      authorName: conn.identity.name,
      authorColor: conn.identity.color,
      text: body,
      createdAt: Date.now(),
    };
    conn.appendCommentMessage(comment.id, msg);
    setText('');
  };

  return (
    <div ref={cardRef} className="comment-card panel" role="dialog" aria-label="Comment thread">
      <div className="comment-card-head">
        <span className="comment-card-title">{comment.resolved ? 'Resolved' : 'Comment'}</span>
        <div className="comment-card-actions">
          <button
            type="button"
            className="comment-icon-btn"
            aria-label={comment.resolved ? 'Reopen' : 'Resolve'}
            title={comment.resolved ? 'Reopen' : 'Resolve'}
            onClick={() => conn.updateComment(comment.id, { resolved: !comment.resolved })}
          >
            <Check size={15} strokeWidth={2.2} />
          </button>
          {conn.canDeleteComment(comment.id) && (
            <button
              type="button"
              className="comment-icon-btn danger"
              aria-label="Delete thread"
              title="Delete thread"
              onClick={() => {
                conn.deleteComment(comment.id);
                onClose();
              }}
            >
              <Trash2 size={15} strokeWidth={2.2} />
            </button>
          )}
          <button type="button" className="comment-icon-btn" aria-label="Close" onClick={onClose}>
            <X size={15} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <div className="comment-thread">
        {comment.messages.map((m) => (
          <div key={m.id} className="comment-msg">
            <span className="comment-avatar" style={{ background: m.authorColor }} aria-hidden>
              {initialOf(m.authorName)}
            </span>
            <div className="comment-msg-body">
              <div className="comment-msg-meta">
                <strong>{m.authorName}</strong>
                <time dateTime={new Date(m.createdAt).toISOString()}>{formatRelativeTime(m.createdAt)}</time>
              </div>
              <p>{m.text}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="comment-composer">
        <span className="comment-avatar sm" style={{ background: conn.identity.color }} aria-hidden>
          {initialOf(conn.identity.name)}
        </span>
        <div className="comment-composer-col">
          <textarea
            ref={inputRef}
            className="comment-input"
            rows={2}
            placeholder="Reply…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                post();
              }
            }}
          />
          <div className="comment-composer-row">
            <EmojiPicker
              side="top"
              onPick={(emoji) => {
                const el = inputRef.current;
                if (!el) return;
                setText(insertIntoTextarea(el, emoji));
                el.focus();
              }}
            />
            <button type="button" className="btn btn-primary comment-post" disabled={!text.trim()} onClick={post}>
              Reply
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DraftCard({
  conn,
  draft,
  onCancel,
  onPosted,
}: {
  conn: RoomConnection;
  draft: CommentDraft;
  onCancel: () => void;
  onPosted: (id: string) => void;
}) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (cardRef.current?.contains(e.target as Node)) return;
      if ((e.target as HTMLElement).closest?.('.comment-pin')) return;
      onCancel();
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [onCancel]);

  const post = () => {
    const body = text.trim();
    if (!body) return;
    const id = nanoid(OBJECT_ID_LENGTH);
    const msg: CommentMessage = {
      id: nanoid(8),
      authorId: conn.identity.id,
      authorName: conn.identity.name,
      authorColor: conn.identity.color,
      text: body,
      createdAt: Date.now(),
    };
    conn.addComment({
      id,
      x: draft.x,
      y: draft.y,
      ox: draft.ox,
      oy: draft.oy,
      targetId: draft.targetId,
      resolved: false,
      messages: [msg],
    });
    onPosted(id);
  };

  return (
    <div ref={cardRef} className="comment-card panel" role="dialog" aria-label="New comment">
      <div className="comment-card-head">
        <span className="comment-card-title">New comment</span>
        <button type="button" className="comment-icon-btn" aria-label="Cancel" onClick={onCancel}>
          <X size={15} strokeWidth={2.2} />
        </button>
      </div>
      <div className="comment-composer draft">
        <span className="comment-avatar" style={{ background: conn.identity.color }} aria-hidden>
          {initialOf(conn.identity.name)}
        </span>
        <div className="comment-composer-col">
          <textarea
            ref={inputRef}
            className="comment-input"
            rows={3}
            placeholder="Add a comment…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                post();
              }
              if (e.key === 'Escape') onCancel();
            }}
          />
          <div className="comment-composer-row">
            <EmojiPicker
              side="top"
              onPick={(emoji) => {
                const el = inputRef.current;
                if (!el) return;
                setText(insertIntoTextarea(el, emoji));
                el.focus();
              }}
            />
            <span className="comment-composer-spacer" />
            <button type="button" className="btn btn-primary" disabled={!text.trim()} onClick={post}>
              Comment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Build a draft pin on an object (top-right) or free world point. */
export function makeCommentDraft(
  world: { x: number; y: number },
  target?: CanvasObject | null,
): CommentDraft {
  if (target) {
    const ox = Math.min(Math.max(world.x - target.x, 12), Math.max(target.width - 12, 12));
    const oy = Math.min(Math.max(world.y - target.y, 8), Math.max(target.height - 8, 8));
    return {
      x: target.x + ox,
      y: target.y + oy,
      ox,
      oy,
      targetId: target.id,
    };
  }
  return { x: world.x, y: world.y, ox: 0, oy: 0, targetId: null };
}
