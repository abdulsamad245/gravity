import { FileText, Film } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import type { CanvasObject } from '../../shared/types';
import { resolveMediaUrl } from '../../shared/utils/media-url';
import { useUiStore } from '../../stores/ui.store';
import { useViewStore } from '../../stores/view.store';

interface Props {
  objects: CanvasObject[];
  interactive: boolean;
}

/**
 * HTML layer for board videos and file cards.
 * Pointer events stay off until the object is selected so Konva can drag/select.
 */
export function MediaResourceOverlay({ objects, interactive }: Props) {
  const view = useViewStore();
  const selectedId = useUiStore((s) => s.selectedId);
  const media = objects.filter((o) => (o.type === 'video' || o.type === 'file') && o.src);
  if (media.length === 0) return null;

  return (
    <div className="media-resource-overlay" aria-hidden>
      {media.map((obj) => {
        const left = obj.x * view.scale + view.x;
        const top = obj.y * view.scale + view.y;
        const width = Math.max(1, obj.width * view.scale);
        const height = Math.max(1, obj.height * view.scale);
        const selected = selectedId === obj.id;
        const live = selected && interactive;
        const style: CSSProperties = {
          left,
          top,
          width,
          height,
          transform: obj.rotation ? `rotate(${obj.rotation}deg)` : undefined,
          opacity: typeof obj.opacity === 'number' ? obj.opacity : 1,
          pointerEvents: live ? 'auto' : 'none',
        };
        if (obj.type === 'video') {
          return <BoardVideo key={obj.id} src={obj.src!} style={style} live={live} />;
        }
        return (
          <BoardFileCard
            key={obj.id}
            name={obj.fileName || obj.text || 'File'}
            mime={obj.mimeType}
            src={obj.src!}
            style={style}
            live={live}
          />
        );
      })}
    </div>
  );
}

function BoardVideo({ src, style, live }: { src: string; style: CSSProperties; live: boolean }) {
  const [url, setUrl] = useState(resolveMediaUrl(src));

  useEffect(() => {
    setUrl(resolveMediaUrl(src));
  }, [src]);

  return (
    <div className={`board-video-card${live ? ' live' : ''}`} style={style}>
      <video
        className="board-video-el"
        src={url}
        controls={live}
        playsInline
        preload="metadata"
      />
      <span className="board-video-badge" aria-hidden>
        <Film size={12} /> {live ? 'Video' : 'Select to play'}
      </span>
    </div>
  );
}

function BoardFileCard({
  name,
  mime,
  src,
  style,
  live,
}: {
  name: string;
  mime?: string;
  src: string;
  style: CSSProperties;
  live: boolean;
}) {
  const href = resolveMediaUrl(src);
  const kind = mime?.includes('pdf') || name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'File';

  if (!live) {
    return (
      <div className="board-file-card" style={style}>
        <span className="board-file-icon" aria-hidden>
          <FileText size={22} />
        </span>
        <span className="board-file-meta">
          <span className="board-file-kind">{kind}</span>
          <span className="board-file-name">{name}</span>
        </span>
      </div>
    );
  }

  return (
    <a
      className="board-file-card live"
      style={style}
      href={href}
      download={name}
      target="_blank"
      rel="noopener noreferrer"
      title={`Open ${name}`}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="board-file-icon" aria-hidden>
        <FileText size={22} />
      </span>
      <span className="board-file-meta">
        <span className="board-file-kind">{kind}</span>
        <span className="board-file-name">{name}</span>
      </span>
    </a>
  );
}
