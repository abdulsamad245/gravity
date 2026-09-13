import { ChevronDown, Search, X } from 'lucide-react';
import { useMemo, useState, type CSSProperties } from 'react';
import { nanoid } from 'nanoid';
import { DEFAULTS, OBJECT_ID_LENGTH } from '../../shared/constants/canvas.constants';
import {
  MORE_SHAPES_SECTIONS,
  type ShapeLibraryAction,
  type ShapeLibraryItem,
  type ShapeLibrarySection,
} from '../../shared/constants/shape-libraries.constants';
import type { CanvasObject, ToolId } from '../../shared/types';
import { useUiStore } from '../../stores/ui.store';
import { screenToWorld, useViewStore } from '../../stores/view.store';
import type { RoomConnection } from '../collaboration/RoomConnection';

interface Props {
  conn: RoomConnection;
  onClose: () => void;
  onPickTool: (tool: ToolId) => void;
}

function viewportCenter() {
  const view = useViewStore.getState();
  return screenToWorld(view, window.innerWidth / 2, window.innerHeight / 2);
}

function placeShape(conn: RoomConnection, type: CanvasObject['type'], label: string) {
  const center = viewportCenter();
  const size =
    type === 'ellipse' || type === 'diamond' || type === 'hexagon' || type === 'star'
      ? DEFAULTS.ellipse
      : type === 'triangle'
        ? DEFAULTS.triangle
        : type === 'blockArrow'
          ? DEFAULTS.blockArrow
          : DEFAULTS.rect;
  const id = nanoid(OBJECT_ID_LENGTH);
  conn.addObject({
    id,
    type,
    text: label || undefined,
    x: center.x - size.width / 2,
    y: center.y - size.height / 2,
    width: size.width,
    height: size.height,
    rotation: 0,
    fill: '#ffffff',
    stroke: '#3d4454',
    strokeWidth: 1.5,
    textColor: '#1c1c1e',
    z: conn.nextZ(),
    createdBy: conn.identity.id,
  });
  useUiStore.getState().setSelectedId(id);
  useUiStore.getState().setTool('select');
}

function runAction(
  conn: RoomConnection,
  action: ShapeLibraryAction,
  onPickTool: (tool: ToolId) => void,
  onClose: () => void,
) {
  if (action.kind === 'tool') {
    onPickTool(action.tool);
    return;
  }
  if (action.kind === 'stamp') {
    useUiStore.getState().setStampGifSrc(null);
    useUiStore.getState().setStampGlyph(action.glyph);
    useUiStore.getState().setTool('stamp');
    onClose();
    return;
  }
  placeShape(conn, action.type, action.label);
  onClose();
}

export function MoreShapesPanel({ conn, onClose, onPickTool }: Props) {
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  /** Sections expanded past the preview grid (+N shapes). */
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const needle = query.trim().toLowerCase();

  const sections = useMemo(() => {
    if (!needle) return MORE_SHAPES_SECTIONS;
    return MORE_SHAPES_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          item.label.toLowerCase().includes(needle) ||
          section.title.toLowerCase().includes(needle) ||
          item.id.includes(needle),
      ),
    })).filter((section) => section.items.length > 0);
  }, [needle]);

  const toggle = (id: string) => {
    setCollapsed((cur) => ({ ...cur, [id]: !cur[id] }));
  };

  const pick = (item: ShapeLibraryItem) => {
    runAction(conn, item.action, onPickTool, onClose);
  };

  const renderSection = (section: ShapeLibrarySection, previewLimit?: number) => {
    const isCollapsed = !!collapsed[section.id];
    const showAll = !previewLimit || !!needle || !!expanded[section.id];
    const items = showAll ? section.items : section.items.slice(0, previewLimit);
    const hidden = Math.max(0, section.items.length - items.length);

    return (
      <section key={section.id} className="more-shapes-section">
        <button
          type="button"
          className="more-shapes-section-head"
          aria-expanded={!isCollapsed}
          onClick={() => toggle(section.id)}
        >
          <span>{section.title}</span>
          <ChevronDown
            size={16}
            strokeWidth={2}
            className={isCollapsed ? 'collapsed' : ''}
            aria-hidden
          />
        </button>
        {!isCollapsed && (
          <>
            <div className="more-shapes-grid" role="list">
              {items.map((item) => {
                const Icon = item.icon;
                const color = item.color ?? section.color;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`more-shapes-cell${color ? ' tinted' : ''}`}
                    role="listitem"
                    title={item.label}
                    aria-label={item.label}
                    style={
                      color
                        ? ({ color, ['--shape-tint' as string]: color } as CSSProperties)
                        : undefined
                    }
                    onClick={() => pick(item)}
                  >
                    <Icon size={20} strokeWidth={1.75} aria-hidden />
                  </button>
                );
              })}
            </div>
            {hidden > 0 && (
              <button
                type="button"
                className="more-shapes-more"
                onClick={() => {
                  setExpanded((cur) => ({ ...cur, [section.id]: true }));
                  setCollapsed((cur) => ({ ...cur, [section.id]: false }));
                }}
              >
                +{hidden} shapes
              </button>
            )}
          </>
        )}
      </section>
    );
  };

  return (
    <div className="more-shapes-panel panel" role="dialog" aria-label="More shapes">
      <header className="more-shapes-top">
        <strong>More shapes</strong>
        <button type="button" className="more-shapes-close" aria-label="Close" onClick={onClose}>
          <X size={16} strokeWidth={2.25} />
        </button>
      </header>

      <label className="more-shapes-search">
        <Search size={15} aria-hidden />
        <input
          className="input"
          placeholder="Search shapes"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search shapes"
        />
      </label>

      <div className="more-shapes-body">
        {sections.map((section) =>
          renderSection(section, section.id === 'building-tools' ? undefined : 12),
        )}
        {sections.length === 0 && <p className="more-shapes-empty">No shapes match that search.</p>}
      </div>
    </div>
  );
}
