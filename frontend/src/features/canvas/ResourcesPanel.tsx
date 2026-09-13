import {
  File,
  FileText,
  Film,
  Image as ImageIcon,
  LayoutTemplate,
  Music,
  Table2,
  X,
} from 'lucide-react';
import { useRef } from 'react';
import { nanoid } from 'nanoid';
import { DEFAULTS, DEFAULT_TABLE_CELLS, OBJECT_ID_LENGTH } from '../../shared/constants/canvas.constants';
import {
  BOARD_FILE_ACCEPT,
  VIDEO_ACCEPT,
} from '../../shared/constants/media.constants';
import { dialogAlert } from '../../shared/components/DialogHost';
import { useUiStore } from '../../stores/ui.store';
import { screenToWorld, useViewStore } from '../../stores/view.store';
import type { RoomConnection } from '../collaboration/RoomConnection';
import { fileToBoardFileObject, fileToVideoObject } from '../media/board-file-utils';
import { fileToImageObject } from '../media/image-utils';

interface Props {
  conn: RoomConnection;
  onClose: () => void;
  onRequestAudio: () => void;
}

function viewportCenter() {
  const view = useViewStore.getState();
  return screenToWorld(view, window.innerWidth / 2, window.innerHeight / 2);
}

const RESOURCES = [
  { id: 'image', label: 'Image', icon: ImageIcon },
  { id: 'video', label: 'Video', icon: Film },
  { id: 'audio', label: 'Audio', icon: Music },
  { id: 'document', label: 'Document', icon: FileText },
  { id: 'table', label: 'Table', icon: Table2 },
  { id: 'slide', label: 'Slide', icon: LayoutTemplate },
  { id: 'pdf', label: 'PDF File', icon: FileText },
  { id: 'file', label: 'File', icon: File },
] as const;

export function ResourcesPanel({ conn, onClose, onRequestAudio }: Props) {
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pdfOnlyRef = useRef<HTMLInputElement>(null);

  const placeTable = () => {
    const center = viewportCenter();
    const { width, height } = DEFAULTS.table;
    const id = nanoid(OBJECT_ID_LENGTH);
    conn.addObject({
      id,
      type: 'table',
      cells: DEFAULT_TABLE_CELLS,
      x: center.x - width / 2,
      y: center.y - height / 2,
      width,
      height,
      rotation: 0,
      fill: '#ffffff',
      stroke: '#4262ff',
      strokeWidth: 1.5,
      z: conn.nextZ(),
      createdBy: conn.identity.id,
    });
    useUiStore.getState().setSelectedId(id);
    useUiStore.getState().setTool('select');
    onClose();
  };

  const placeSlide = () => {
    const center = viewportCenter();
    const { width, height } = DEFAULTS.frame;
    const id = nanoid(OBJECT_ID_LENGTH);
    conn.addObject({
      id,
      type: 'frame',
      text: 'Slide',
      x: center.x - width / 2,
      y: center.y - height / 2,
      width,
      height,
      rotation: 0,
      fill: 'rgba(255,255,255,0.04)',
      stroke: '#4262ff',
      strokeWidth: 2,
      z: conn.nextZ(),
      createdBy: conn.identity.id,
    });
    useUiStore.getState().setSelectedId(id);
    useUiStore.getState().setTool('select');
    onClose();
  };

  const onPick = async (id: (typeof RESOURCES)[number]['id']) => {
    switch (id) {
      case 'image':
        imageRef.current?.click();
        return;
      case 'video':
        videoRef.current?.click();
        return;
      case 'audio':
        onRequestAudio();
        onClose();
        return;
      case 'table':
        placeTable();
        return;
      case 'slide':
        placeSlide();
        return;
      case 'pdf':
        pdfOnlyRef.current?.click();
        return;
      case 'document':
      case 'file':
        fileRef.current?.click();
        return;
      default:
        return;
    }
  };

  return (
    <div className="library-panel panel resources-panel" role="dialog" aria-label="Other resources">
      <div className="library-panel-head">
        <div className="library-panel-title">
          <span>Other resources</span>
        </div>
        <button type="button" className="btn btn-ghost icon-btn" aria-label="Close resources" onClick={onClose}>
          <X size={16} />
        </button>
      </div>
      <p className="library-hint">
        Videos up to 1.5 MB. Files up to 1.5 MB.
      </p>
      <div className="library-grid resources-grid">
        {RESOURCES.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              className="library-tile"
              onClick={() => void onPick(item.id)}
            >
              <span className="library-tile-icon" aria-hidden>
                <Icon size={22} />
              </span>
              <span className="library-tile-label">{item.label}</span>
            </button>
          );
        })}
      </div>

      <input
        ref={imageRef}
        type="file"
        accept="image/*"
        hidden
        onChange={async (e) => {
          const files = e.target.files;
          e.target.value = '';
          if (!files) return;
          for (const file of Array.from(files)) {
            const obj = await fileToImageObject(file, viewportCenter(), conn.nextZ(), conn.identity.id);
            if (obj) conn.addObject(obj);
          }
          onClose();
        }}
      />
      <input
        ref={videoRef}
        type="file"
        accept={VIDEO_ACCEPT}
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          const obj = await fileToVideoObject(file, viewportCenter(), conn.nextZ(), conn.identity.id);
          if (obj) {
            conn.addObject(obj);
            useUiStore.getState().setSelectedId(obj.id);
          }
          onClose();
        }}
      />
      <input
        ref={fileRef}
        type="file"
        accept={BOARD_FILE_ACCEPT}
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          const obj = await fileToBoardFileObject(file, viewportCenter(), conn.nextZ(), conn.identity.id);
          if (obj) {
            conn.addObject(obj);
            useUiStore.getState().setSelectedId(obj.id);
          }
          onClose();
        }}
      />
      <input
        ref={pdfOnlyRef}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
            await dialogAlert('Choose a PDF file.', 'PDF');
            return;
          }
          const obj = await fileToBoardFileObject(file, viewportCenter(), conn.nextZ(), conn.identity.id);
          if (obj) {
            conn.addObject(obj);
            useUiStore.getState().setSelectedId(obj.id);
          }
          onClose();
        }}
      />
    </div>
  );
}
