import {
  Clock3,
  Ellipsis,
  Home,
  LayoutGrid,
  LayoutList,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { dialogConfirm, dialogPrompt } from '../../shared/components/DialogHost';
import { Logo } from '../../shared/components/Logo';
import { SelectMenu } from '../../shared/components/SelectMenu';
import { ThemeSwitcher } from '../../shared/components/ThemeSwitcher';
import { Tooltip } from '../../shared/components/Tooltip';
import { APP_NAME } from '../../shared/constants/app.constants';
import {
  DEFAULT_BOARD_NAME,
  formatBoardAge,
  listBoards,
  listStarredBoards,
  removeBoard,
  renameBoardLocal,
  setBoardStarred,
  setPendingTemplate,
  upsertBoard,
  type BoardEntry,
} from '../../shared/utils/boards';
import { UsernameField } from '../../shared/components/UsernameField';
import { loadIdentity, loadLastName, saveIdentity } from '../../shared/utils/identity';
import { allocateUniqueRoomId } from '../../shared/utils/room-id';
import { roomPath } from '../../shared/utils/room-path';
import { TemplatePreview } from '../templates/TemplatePreview';
import { BOARD_TEMPLATES } from '../templates/templates';

type NavId = 'home' | 'recent' | 'starred';
type ViewMode = 'list' | 'grid';
type SortId = 'opened' | 'name';
const SORT_OPTIONS: ReadonlyArray<{ value: SortId; label: string }> = [
  { value: 'opened', label: 'Last opened' },
  { value: 'name', label: 'Name' },
];

const NAV: Array<{ id: NavId; label: string; icon: typeof Home }> = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'recent', label: 'Recent', icon: Clock3 },
  { id: 'starred', label: 'Starred', icon: Star },
];

/**
 * Personal rooms library.
 * Rooms are scoped to this tab's guest identity, not a global guest shelf.
 */
export function BoardsPage() {
  const navigate = useNavigate();
  const [identity, setIdentity] = useState(() => loadIdentity());
  const [nameDraft, setNameDraft] = useState(loadLastName());
  const [nav, setNav] = useState<NavId>('home');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<ViewMode>('list');
  const [sort, setSort] = useState<SortId>('opened');
  const [boards, setBoards] = useState<BoardEntry[]>([]);
  const [menuId, setMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const refresh = () => setBoards(listBoards());

  useEffect(() => {
    if (identity) refresh();
  }, [identity]);

  useEffect(() => {
    if (!menuId) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuId(null);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [menuId]);

  const enter = () => {
    if (nameDraft.trim().length < 2) return;
    setIdentity(saveIdentity(nameDraft.trim()));
  };

  const filtered = useMemo(() => {
    let list = nav === 'starred' ? listStarredBoards() : boards;
    if (nav === 'recent') list = list.slice(0, 12);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((b) => b.name.toLowerCase().includes(q) || b.id.toLowerCase().includes(q));
    if (sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    else list = [...list].sort((a, b) => (b.openedAt || b.updatedAt) - (a.openedAt || a.updatedAt));
    return list;
  }, [boards, nav, query, sort]);

  const createBoard = (templateId?: string) => {
    if (!identity) return;
    void (async () => {
      const id = await allocateUniqueRoomId();
      upsertBoard(id, templateId ? BOARD_TEMPLATES.find((t) => t.id === templateId)?.name : undefined);
      if (templateId) setPendingTemplate(templateId);
      navigate(roomPath(id));
    })();
  };

  const openBoard = (id: string) => {
    upsertBoard(id);
    navigate(roomPath(id));
  };

  const renameBoard = async (b: BoardEntry) => {
    setMenuId(null);
    const next = (await dialogPrompt('Room name', b.name, 'Rename room'))?.trim();
    if (!next) return;
    renameBoardLocal(b.id, next.slice(0, 80) || DEFAULT_BOARD_NAME);
    refresh();
  };

  const deleteBoard = async (b: BoardEntry) => {
    setMenuId(null);
    const ok = await dialogConfirm(
      `Remove "${b.name}" from your rooms? The invite link still works if you have it.`,
      'Remove room',
    );
    if (!ok) return;
    removeBoard(b.id);
    refresh();
  };

  if (!identity) {
    return (
      <div className="boards-gate surface-field">
        <div className="boards-gate-card panel">
          <Logo size={40} />
          <h1>Your rooms</h1>
          <p>Rooms here are private to you in this browser tab. Other guests never see this list.</p>
          <label className="field-label" htmlFor="boards-username">
            Username
          </label>
          <UsernameField
            id="boards-username"
            value={nameDraft}
            autoFocus
            onChange={setNameDraft}
            onEnter={enter}
          />
          <button type="button" className="btn btn-primary" disabled={nameDraft.trim().length < 2} onClick={enter}>
            Continue
          </button>
          <Link to="/" className="boards-gate-home">
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="boards-dash">
      <header className="boards-dash-top">
        <Link to="/" className="boards-dash-brand" aria-label={`${APP_NAME} home`}>
          <Logo size={28} />
        </Link>
        <div className="boards-dash-top-right">
          <ThemeSwitcher compact />
          <span className="boards-dash-avatar" style={{ background: identity.color }} title={identity.name}>
            {initials(identity.name)}
          </span>
        </div>
      </header>

      <div className="boards-dash-body">
        <aside className="boards-dash-nav panel" aria-label="Room navigation">
          <label className="boards-dash-search">
            <Search size={15} aria-hidden />
            <input
              className="input"
              placeholder="Search by title"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search rooms"
            />
          </label>
          <nav className="boards-dash-links">
            {NAV.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={nav === id ? 'active' : ''}
                onClick={() => setNav(id)}
              >
                <Icon size={16} /> {label}
              </button>
            ))}
          </nav>
          <p className="boards-dash-nav-note">Private to {identity.name}. Not shared with other guests.</p>
        </aside>

        <main className="boards-dash-main">
          <section className="boards-templates-strip" id="boards-templates" aria-label="Templates">
            <div className="boards-section-head">
              <h2>Templates</h2>
            </div>
            <div className="boards-templates-row">
              <button type="button" className="boards-template-card blank" onClick={() => createBoard()}>
                <Plus size={28} />
                <span>Blank room</span>
              </button>
              {BOARD_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="boards-template-card"
                  onClick={() => createBoard(t.id)}
                >
                  <TemplatePreview preview={t.preview} />
                  <strong>{t.name}</strong>
                  <span>{t.description}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="boards-library" aria-label="Your rooms">
            <div className="boards-section-head">
              <h2>
                {nav === 'starred' ? 'Starred rooms' : nav === 'recent' ? 'Recent rooms' : 'Your rooms'}
              </h2>
              <div className="boards-section-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() =>
                    document.getElementById('boards-templates')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }
                >
                  Explore templates
                </button>
                <button type="button" className="btn btn-primary" onClick={() => createBoard()}>
                  <Plus size={16} /> Create new
                </button>
              </div>
            </div>

            <div className="boards-toolbar">
              <label className="boards-sort">
                Sort by
                <SelectMenu value={sort} options={SORT_OPTIONS} onChange={setSort} ariaLabel="Sort rooms" />
              </label>
              <div className="boards-view-toggle" role="group" aria-label="View mode">
                <Tooltip label="List view">
                  <button
                    type="button"
                    className={`btn btn-ghost icon-btn ${view === 'list' ? 'active-soft' : ''}`}
                    aria-pressed={view === 'list'}
                    onClick={() => setView('list')}
                  >
                    <LayoutList size={16} />
                  </button>
                </Tooltip>
                <Tooltip label="Grid view">
                  <button
                    type="button"
                    className={`btn btn-ghost icon-btn ${view === 'grid' ? 'active-soft' : ''}`}
                    aria-pressed={view === 'grid'}
                    onClick={() => setView('grid')}
                  >
                    <LayoutGrid size={16} />
                  </button>
                </Tooltip>
              </div>
            </div>

            {filtered.length === 0 ? (
              <div className="boards-empty panel">
                <p>
                  {nav === 'starred'
                    ? 'No starred rooms yet. Star one from the list.'
                    : query
                      ? 'No rooms match that search.'
                      : 'No rooms yet. Create a blank room or start from a template.'}
                </p>
                {nav !== 'starred' && !query && (
                  <button type="button" className="btn btn-primary" onClick={() => createBoard()}>
                    <Plus size={16} /> Create new
                  </button>
                )}
              </div>
            ) : view === 'grid' ? (
              <div className="boards-grid">
                {filtered.map((b) => (
                  <article key={b.id} className="boards-grid-card panel">
                    <button type="button" className="boards-grid-open" onClick={() => openBoard(b.id)}>
                      <span className="boards-grid-preview" aria-hidden />
                      <strong>{b.name}</strong>
                      <span>Opened {formatBoardAge(b.openedAt || b.updatedAt)}</span>
                    </button>
                    <div className="boards-grid-ops">
                      <button
                        type="button"
                        className={`btn btn-ghost icon-btn ${b.starred ? 'starred' : ''}`}
                        aria-label={b.starred ? 'Unstar' : 'Star'}
                        onClick={() => {
                          setBoardStarred(b.id, !b.starred);
                          refresh();
                        }}
                      >
                        <Star size={16} fill={b.starred ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost icon-btn"
                        aria-label="Rename"
                        onClick={() => void renameBoard(b)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost icon-btn"
                        aria-label="Remove"
                        onClick={() => void deleteBoard(b)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="boards-list panel">
                <div className="boards-list-head" aria-hidden>
                  <span>Name</span>
                  <span>Last opened</span>
                  <span>Owner</span>
                  <span />
                </div>
                <ul className="boards-list-body">
                  {filtered.map((b) => (
                    <li key={b.id} className="boards-list-row">
                      <button type="button" className="boards-list-name" onClick={() => openBoard(b.id)}>
                        <span className="boards-list-icon" aria-hidden />
                        <span>
                          <strong>{b.name}</strong>
                          <small>
                            Modified {formatBoardAge(b.updatedAt)} · #{b.id}
                          </small>
                        </span>
                      </button>
                      <span className="boards-list-opened">{formatBoardAge(b.openedAt || b.updatedAt)}</span>
                      <span className="boards-list-owner">{b.ownerName || identity.name}</span>
                      <div className="boards-list-ops" ref={menuId === b.id ? menuRef : undefined}>
                        <button
                          type="button"
                          className={`btn btn-ghost icon-btn ${b.starred ? 'starred' : ''}`}
                          aria-label={b.starred ? 'Unstar' : 'Star'}
                          onClick={() => {
                            setBoardStarred(b.id, !b.starred);
                            refresh();
                          }}
                        >
                          <Star size={16} fill={b.starred ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost icon-btn"
                          aria-label="More"
                          aria-expanded={menuId === b.id}
                          onClick={() => setMenuId(menuId === b.id ? null : b.id)}
                        >
                          <Ellipsis size={16} />
                        </button>
                        {menuId === b.id && (
                          <div className="boards-row-menu panel" role="menu">
                            <button type="button" role="menuitem" onClick={() => void renameBoard(b)}>
                              <Pencil size={14} /> Rename
                            </button>
                            <button type="button" role="menuitem" className="danger" onClick={() => void deleteBoard(b)}>
                              <Trash2 size={14} /> Remove
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
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
