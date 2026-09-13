import { Plus, Trash2, X } from 'lucide-react';
import { nanoid } from 'nanoid';
import type { CanvasObject, StructuredRecord, StructuredViewMode } from '../../shared/types';

interface Props {
  obj: CanvasObject;
  onPatch: (patch: Partial<CanvasObject>) => void;
  onClose: () => void;
}

const VIEW_MODES: StructuredViewMode[] = ['table', 'kanban', 'timeline'];

export function StructuredDataOverlay({ obj, onPatch, onClose }: Props) {
  const records = obj.records ?? [];

  const update = (id: string, patch: Partial<StructuredRecord>) => {
    onPatch({ records: records.map((record) => (record.id === id ? { ...record, ...patch } : record)) });
  };

  const remove = (id: string) => {
    onPatch({ records: records.filter((record) => record.id !== id) });
  };

  const add = () => {
    onPatch({
      records: [
        ...records,
        {
          id: nanoid(8),
          title: 'New item',
          status: obj.dataView === 'kanban' ? 'To do' : 'Planned',
          priority: 'Medium',
        },
      ],
    });
  };

  return (
    <aside className="structured-data-overlay panel" role="dialog" aria-label="Structured data editor">
      <header className="structured-data-header">
        <div>
          <strong>Structured data</strong>
          <span>One dataset, three synchronized views</span>
        </div>
        <button type="button" className="btn btn-ghost icon-btn" onClick={onClose} aria-label="Close data editor">
          <X size={17} />
        </button>
      </header>
      <div className="structured-view-tabs" role="group" aria-label="Data view">
        {VIEW_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            className={`btn ${obj.dataView === mode ? 'btn-accent' : ''}`}
            onClick={() => onPatch({ dataView: mode })}
          >
            {mode[0].toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>
      <div className="structured-record-list">
        {records.map((record) => (
          <div key={record.id} className="structured-record">
            <input
              value={record.title}
              onChange={(event) => update(record.id, { title: event.target.value })}
              aria-label="Record title"
            />
            <input
              value={record.status}
              onChange={(event) => update(record.id, { status: event.target.value })}
              aria-label="Record status"
            />
            <input
              type="date"
              value={record.start ?? ''}
              onChange={(event) => update(record.id, { start: event.target.value })}
              aria-label="Start date"
            />
            <input
              type="date"
              value={record.end ?? ''}
              onChange={(event) => update(record.id, { end: event.target.value })}
              aria-label="End date"
            />
            <button type="button" className="btn btn-ghost icon-btn" onClick={() => remove(record.id)} aria-label="Delete record">
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>
      <button type="button" className="btn" onClick={add}>
        <Plus size={15} />
        Add record
      </button>
    </aside>
  );
}
