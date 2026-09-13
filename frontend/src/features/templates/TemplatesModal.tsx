import { useEffect, useMemo, useState } from 'react';
import { CloseButton } from '../../shared/components/CloseButton';
import { ASSISTANT_NAME } from '../../shared/constants/app.constants';
import { useOpenTransition } from '../../shared/hooks/useOpenTransition';
import type { RoomConnection } from '../collaboration/RoomConnection';
import { TemplatePreview } from './TemplatePreview';
import { BOARD_TEMPLATES, type BoardTemplate } from './templates';

interface Props {
  conn: RoomConnection;
  onClose: () => void;
  onOpenOrbit?: () => void;
  /** Open on a specific category rail (e.g. diagram from Shapes). */
  initialNav?: string;
}

const NAV: Array<{ id: string; label: string; filter?: (t: BoardTemplate) => boolean }> = [
  { id: 'all', label: 'All templates' },
  { id: 'brainstorm', label: 'Ideation & brainstorming', filter: (t) => t.category === 'brainstorm' },
  { id: 'retro', label: 'Meetings & workshops', filter: (t) => t.category === 'retro' },
  { id: 'kanban', label: 'Agile workflows', filter: (t) => t.category === 'kanban' },
  { id: 'diagram', label: 'Diagramming & mapping', filter: (t) => t.category === 'diagram' },
];

export function TemplatesModal({ conn, onClose, onOpenOrbit, initialNav = 'all' }: Props) {
  const { requestClose, className } = useOpenTransition(onClose);
  const [nav, setNav] = useState(() => (NAV.some((n) => n.id === initialNav) ? initialNav : 'all'));
  const [q, setQ] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [requestClose]);

  const list = useMemo(() => {
    const entry = NAV.find((n) => n.id === nav);
    let items = BOARD_TEMPLATES.filter((t) => (entry?.filter ? entry.filter(t) : true));
    const needle = q.trim().toLowerCase();
    if (needle) {
      items = items.filter(
        (t) => t.name.toLowerCase().includes(needle) || t.description.toLowerCase().includes(needle),
      );
    }
    return items;
  }, [nav, q]);

  return (
    <div className={`modal-backdrop ${className}`} role="presentation" onClick={requestClose}>
      <div
        className="templates-shell panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="templates-title"
        onClick={(e) => e.stopPropagation()}
      >
        <nav className="templates-nav" aria-label="Template categories">
          {NAV.map((n) => (
            <button key={n.id} type="button" className={nav === n.id ? 'active' : ''} onClick={() => setNav(n.id)}>
              {n.label}
            </button>
          ))}
        </nav>

        <div className="templates-main">
          <div className="templates-main-head">
            <h2 id="templates-title">Templates</h2>
            <CloseButton onClick={requestClose} label="Close templates" />
          </div>
          <input
            className="input templates-search"
            placeholder="Search templates by name or category"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Search templates"
          />
          {onOpenOrbit && (
            <div className="templates-banner">
              <div>
                <strong>Spin up with {ASSISTANT_NAME}</strong>
                <p>Describe a board and Orbit can build it. Canvas edits stay yours.</p>
              </div>
              <button
                type="button"
                className="btn btn-share"
                onClick={() => {
                  onOpenOrbit();
                  requestClose();
                }}
              >
                Open {ASSISTANT_NAME}
              </button>
            </div>
          )}
          <div className="templates-grid">
            {list.map((t) => (
              <button
                key={t.id}
                type="button"
                className="template-card"
                onClick={() => {
                  for (const obj of t.build(conn.identity.id)) conn.addObject(obj);
                  requestClose();
                }}
              >
                <TemplatePreview preview={t.preview} />
                <strong>{t.name}</strong>
                <span>{t.description}</span>
              </button>
            ))}
            {list.length === 0 && <p className="modal-desc">No templates match that search.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
