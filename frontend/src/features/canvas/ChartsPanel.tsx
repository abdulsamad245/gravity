import { BarChart3, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { nanoid } from 'nanoid';
import { DEFAULTS, OBJECT_ID_LENGTH } from '../../shared/constants/canvas.constants';
import {
  CHART_DEFINITIONS,
  DEFAULT_CHART_CATEGORIES,
  DEFAULT_CHART_SERIES,
  type ChartKind,
} from '../../shared/constants/chart.constants';
import { useUiStore } from '../../stores/ui.store';
import { screenToWorld, useViewStore } from '../../stores/view.store';
import type { RoomConnection } from '../collaboration/RoomConnection';

interface Props {
  conn: RoomConnection;
  onClose: () => void;
}

function viewportCenter() {
  const view = useViewStore.getState();
  return screenToWorld(view, window.innerWidth / 2, window.innerHeight / 2);
}

function placeChart(conn: RoomConnection, kind: ChartKind, label: string) {
  const center = viewportCenter();
  const { width, height } = DEFAULTS.chart;
  const id = nanoid(OBJECT_ID_LENGTH);
  conn.addObject({
    id,
    type: 'chart',
    text: label,
    chartKind: kind,
    chartCategories: [...DEFAULT_CHART_CATEGORIES],
    chartSeries: DEFAULT_CHART_SERIES.map((s) => ({ ...s, values: [...s.values] })),
    x: center.x - width / 2,
    y: center.y - height / 2,
    width,
    height,
    rotation: 0,
    fill: '#16181f',
    stroke: '#3d4454',
    strokeWidth: 1.5,
    textColor: '#e8eaed',
    z: conn.nextZ(),
    createdBy: conn.identity.id,
  });
  useUiStore.getState().setSelectedId(id);
  useUiStore.getState().setTool('select');
}

export function ChartsPanel({ conn, onClose }: Props) {
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();

  const sections = useMemo(() => {
    const filtered = needle
      ? CHART_DEFINITIONS.filter(
          (d) =>
            d.label.toLowerCase().includes(needle) ||
            d.category.toLowerCase().includes(needle) ||
            d.kind.toLowerCase().includes(needle),
        )
      : CHART_DEFINITIONS;
    const map = new Map<string, typeof filtered>();
    for (const d of filtered) {
      const list = map.get(d.category) ?? [];
      list.push(d);
      map.set(d.category, list);
    }
    return [...map.entries()];
  }, [needle]);

  return (
    <div className="library-panel panel charts-panel" role="dialog" aria-label="Charts">
      <div className="library-panel-head">
        <div className="library-panel-title">
          <BarChart3 size={16} aria-hidden />
          <span>Charts</span>
        </div>
        <button type="button" className="btn btn-ghost icon-btn" aria-label="Close charts" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <label className="library-search">
        <Search size={14} aria-hidden />
        <input
          type="search"
          placeholder="Search charts"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="library-panel-body">
        {sections.map(([title, items]) => (
          <section key={title} className="library-section">
            <h3 className="library-section-title">{title}</h3>
            <div className="library-grid chart-grid">
              {items.map((item) => (
                <button
                  key={item.kind}
                  type="button"
                  className="library-tile chart-tile"
                  onClick={() => {
                    placeChart(conn, item.kind, item.label);
                    onClose();
                  }}
                >
                  <span className={`chart-preview chart-preview-${item.kind}`} aria-hidden />
                  <span className="library-tile-label">{item.label}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
        {sections.length === 0 && <p className="library-empty">No charts match that search.</p>}
      </div>
    </div>
  );
}
