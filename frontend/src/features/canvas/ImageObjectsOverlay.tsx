import { useEffect, useState, type CSSProperties } from 'react';
import { MEDIA_API_PATH } from '../../shared/constants/app.constants';
import type { CanvasObject } from '../../shared/types';
import { resolveMediaUrl } from '../../shared/utils/media-url';
import { useViewStore } from '../../stores/view.store';

interface Props {
  objects: CanvasObject[];
}

/**
 * HTML &lt;img&gt; layer for board images. More reliable than Konva for
 * `/api/v1/media/...` URLs and keeps GIFs animated.
 */
export function ImageObjectsOverlay({ objects }: Props) {
  const view = useViewStore();
  const images = objects.filter((o) => o.type === 'image' && o.src);
  if (images.length === 0) return null;

  return (
    <div className="image-objects-overlay" aria-hidden>
      {images.map((obj) => {
        const left = obj.x * view.scale + view.x;
        const top = obj.y * view.scale + view.y;
        const width = Math.max(1, obj.width * view.scale);
        const height = Math.max(1, obj.height * view.scale);
        return (
          <BoardImage
            key={obj.id}
            src={obj.src!}
            style={{
              left,
              top,
              width,
              height,
              transform: obj.rotation ? `rotate(${obj.rotation}deg)` : undefined,
              opacity: typeof obj.opacity === 'number' ? obj.opacity : 1,
            }}
          />
        );
      })}
    </div>
  );
}

function BoardImage({ src, style }: { src: string; style: CSSProperties }) {
  const [displaySrc, setDisplaySrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setFailed(false);
    setDisplaySrc(null);

    const candidates = mediaCandidates(src);

    const tryFetchBlob = async (url: string): Promise<string | null> => {
      if (url.startsWith('data:') || url.startsWith('blob:')) return null;
      try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const blob = await res.blob();
        if (!blob.size) return null;
        objectUrl = URL.createObjectURL(blob);
        return objectUrl;
      } catch {
        return null;
      }
    };

    const load = async () => {
      for (const url of candidates) {
        if (cancelled) return;
        const ok = await probeImage(url);
        if (cancelled) return;
        if (ok) {
          setDisplaySrc(url);
          return;
        }
        const blobSrc = await tryFetchBlob(url);
        if (cancelled) return;
        if (blobSrc) {
          setDisplaySrc(blobSrc);
          return;
        }
      }
      if (!cancelled) setFailed(true);
    };

    void load();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (failed || !displaySrc) {
    return (
      <div
        className="image-object-fallback"
        style={style}
        title={failed ? 'Image unavailable' : 'Loading image'}
      >
        <span>{failed ? 'Image unavailable' : ''}</span>
      </div>
    );
  }

  return (
    <img
      className="image-object-img"
      src={displaySrc}
      alt=""
      draggable={false}
      style={style}
      onError={() => setFailed(true)}
    />
  );
}

function probeImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

/** Prefer same-origin /api paths; keep absolute and data/blob fallbacks. */
function mediaCandidates(src: string): string[] {
  const out: string[] = [];
  const push = (u: string) => {
    if (u && !out.includes(u)) out.push(u);
  };

  const mediaPath = extractMediaPath(src);
  if (mediaPath) {
    // Same-origin first (Vite proxy / Nginx) — avoids CORP issues.
    push(mediaPath);
    if (typeof window !== 'undefined' && window.location?.origin) {
      push(`${window.location.origin}${mediaPath}`);
    }
  }

  push(resolveMediaUrl(src));
  push(src);
  return out;
}

function extractMediaPath(src: string): string | null {
  if (src.startsWith(`${MEDIA_API_PATH}/`)) return src.split('?')[0] ?? src;
  try {
    if (src.startsWith('http://') || src.startsWith('https://')) {
      const u = new URL(src);
      if (u.pathname.startsWith(`${MEDIA_API_PATH}/`)) return u.pathname;
    }
  } catch {
    /* ignore */
  }
  return null;
}
