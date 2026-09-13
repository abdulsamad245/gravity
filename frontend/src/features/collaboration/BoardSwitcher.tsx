import { ChevronDown, LayoutGrid, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tooltip } from '../../shared/components/Tooltip';
import {
  DEFAULT_BOARD_NAME,
  formatBoardAge,
  listBoards,
  removeBoard,
  type BoardEntry,
} from '../../shared/utils/boards';
import { allocateUniqueRoomId } from '../../shared/utils/room-id';
import { roomPath } from '../../shared/utils/room-path';
import type { RoomConnection } from './RoomConnection';
import { useBoardTitle } from './useBoardTitle';

interface Props {
  conn: RoomConnection;
}

const RECENT_LIMIT = 5;

/** Room title rename + recent rooms menu (full list lives on /rooms). */
export function BoardSwitcher({ conn }: Props) {
  const navigate = useNavigate();
  const { title, setTitle } = useBoardTitle(conn);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [menuOpen, setMenuOpen] = useState(false);
  const [boards, setBoards] = useState<BoardEntry[]>(() => listBoards());
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef(draft);
  const titleRef = useRef(title);
  const editingRef = useRef(editing);

  draftRef.current = draft;
  titleRef.current = title;
  editingRef.current = editing;

  const refreshBoards = () => setBoards(listBoards());

  const commitRename = () => {
    const next = draftRef.current.trim() || DEFAULT_BOARD_NAME;
    setTitle(next);
    setEditing(false);
    refreshBoards();
  };

  useEffect(() => {
    if (!menuOpen && !editing) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        if (editingRef.current) commitRename();
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [menuOpen, editing]);

  useEffect(() => {
    if (!editing) setDraft(title);
  }, [title, editing]);

  useEffect(() => {
    if (editing) {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [editing]);

  const recent = boards.slice(0, RECENT_LIMIT);

  return (
    <div className="board-meta export-menu" ref={rootRef} data-tour="boards">
      {editing ? (
        <input
          ref={inputRef}
          className="input board-title-input"
          value={draft}
          maxLength={80}
          aria-label="Room name"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitRename();
            }
            if (e.key === 'Escape') {
              setDraft(titleRef.current);
              setEditing(false);
            }
          }}
        />
      ) : (
        <Tooltip label="Rename room">
          <button
            type="button"
            className="board-title-btn"
            aria-label={`Room: ${title}. Click to rename.`}
            onClick={() => {
              setMenuOpen(false);
              setDraft(title);
              setEditing(true);
            }}
          >
            <span className="board-title">{title}</span>
          </button>
        </Tooltip>
      )}

      <Tooltip label="Your rooms">
        <button
          type="button"
          className="btn btn-ghost icon-btn"
          aria-label="Rooms menu"
          aria-expanded={menuOpen}
          onClick={() => {
            refreshBoards();
            setMenuOpen((v) => !v);
          }}
        >
          <ChevronDown size={16} strokeWidth={2} />
        </button>
      </Tooltip>

      {menuOpen && (
        <div className="export-dropdown panel boards-dropdown" role="menu">
          <div className="boards-dropdown-label">Recent rooms</div>
          {recent.length === 0 && (
            <div className="boards-dropdown-item" style={{ cursor: 'default', color: 'var(--text-dim)' }}>
              <span className="board-item-name">No rooms yet</span>
              <span className="board-item-meta" />
              <span className="board-item-remove-spacer" />
            </div>
          )}
          {recent.map((b) => (
            <div
              key={b.id}
              className={`boards-dropdown-item ${b.id === conn.roomId ? 'active' : ''}`}
              role="menuitem"
            >
              <button
                type="button"
                className="board-item-name"
                onClick={() => {
                  setMenuOpen(false);
                  if (b.id !== conn.roomId) navigate(roomPath(b.id));
                }}
              >
                {b.name}
              </button>
              <span className="board-item-meta">{formatBoardAge(b.updatedAt)}</span>
              {b.id !== conn.roomId ? (
                <Tooltip label="Remove from this device" side="left">
                  <button
                    type="button"
                    className="board-item-remove"
                    aria-label={`Remove ${b.name} from list`}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeBoard(b.id);
                      refreshBoards();
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </Tooltip>
              ) : (
                <span className="board-item-remove-spacer" aria-hidden />
              )}
            </div>
          ))}
          <div className="boards-dropdown-actions">
            <button
              type="button"
              className="boards-dropdown-item"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                void (async () => {
                  const id = await allocateUniqueRoomId();
                  navigate(roomPath(id));
                })();
              }}
            >
              <Plus size={16} />
              <span className="board-item-name">New room</span>
            </button>
            <button
              type="button"
              className="boards-dropdown-item"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                navigate('/rooms');
              }}
            >
              <LayoutGrid size={16} />
              <span className="board-item-name">All rooms</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
