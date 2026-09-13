import { ExternalLink, Globe } from 'lucide-react';
import { useEffect, useState, type CSSProperties } from 'react';
import type { CanvasObject } from '../../shared/types';
import { planEmbedPreview, type EmbedPreviewPlan } from '../../shared/utils/embed-preview';
import { validateEmbedUrl } from '../../shared/utils/validate-embed-url';
import { useUiStore } from '../../stores/ui.store';
import { useViewStore } from '../../stores/view.store';

interface Props {
  objects: CanvasObject[];
  interactive: boolean;
}

/** How long we wait before treating a silent/blocked iframe as unavailable. */
const IFRAME_PREVIEW_TIMEOUT_MS = 2_800;

function openEmbedUrl(href: string) {
  window.open(href, '_blank', 'noopener,noreferrer');
}

/**
 * Web embeds on the board: try a live preview, show Visit link on hover,
 * and fall back to a clickable link card when the preview cannot load.
 */
export function EmbedObjectsOverlay({ objects, interactive }: Props) {
  const view = useViewStore();
  const selectedId = useUiStore((s) => s.selectedId);
  const setSelectedId = useUiStore((s) => s.setSelectedId);
  const [liveId, setLiveId] = useState<string | null>(null);
  const embeds = objects.filter((o) => o.type === 'embed' && o.src);

  if (embeds.length === 0) return null;

  return (
    <div className="embed-objects-overlay">
      {embeds.map((obj) => {
        const checked = validateEmbedUrl(obj.src ?? '');
        if (!checked.ok) return null;
        const plan = planEmbedPreview(checked.href);
        // Match Konva ObjectNode: position from object center so rotation shares the same pivot.
        const width = Math.max(40, obj.width * view.scale);
        const height = Math.max(40, obj.height * view.scale);
        const left = (obj.x + obj.width / 2) * view.scale + view.x;
        const top = (obj.y + obj.height / 2) * view.scale + view.y;
        const selected = selectedId === obj.id;
        const live = liveId === obj.id && selected && interactive;
        const turn = obj.rotation ? ` rotate(${obj.rotation}deg)` : '';

        return (
          <BoardEmbed
            key={obj.id}
            obj={obj}
            plan={plan}
            pageUrl={checked.href}
            selected={selected}
            live={live}
            interactive={interactive}
            style={{
              left,
              top,
              width,
              height,
              transform: `translate(-50%, -50%)${turn}`,
              opacity: typeof obj.opacity === 'number' ? obj.opacity : 1,
            }}
            onSelect={() => {
              if (interactive) setSelectedId(obj.id);
            }}
            onEnterLive={() => setLiveId(obj.id)}
            onExitLive={() => setLiveId(null)}
          />
        );
      })}
    </div>
  );
}

function BoardEmbed({
  obj,
  plan,
  pageUrl,
  selected,
  live,
  interactive,
  style,
  onSelect,
  onEnterLive,
  onExitLive,
}: {
  obj: CanvasObject;
  plan: EmbedPreviewPlan;
  pageUrl: string;
  selected: boolean;
  live: boolean;
  interactive: boolean;
  style: CSSProperties;
  onSelect: () => void;
  onEnterLive: () => void;
  onExitLive: () => void;
}) {
  const iframeSrc = plan.mode === 'iframe' ? plan.iframeSrc : '';
  const imageSrc = plan.mode === 'image' ? plan.imageSrc : '';

  const [preview, setPreview] = useState<'loading' | 'ready' | 'unavailable'>(() =>
    plan.mode === 'link' ? 'unavailable' : 'loading',
  );

  // Reset only when the URL / plan mode changes — not on every pan/zoom re-render.
  useEffect(() => {
    setPreview(plan.mode === 'link' ? 'unavailable' : 'loading');
  }, [plan.mode, pageUrl, iframeSrc, imageSrc]);

  useEffect(() => {
    if (plan.mode !== 'iframe' || preview !== 'loading') return;
    const timer = window.setTimeout(() => {
      setPreview((current) => (current === 'loading' ? 'unavailable' : current));
    }, IFRAME_PREVIEW_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [plan.mode, iframeSrc, preview, pageUrl]);

  const showPreview = preview === 'ready' || preview === 'loading';
  const showFallback = preview === 'unavailable';

  return (
    <div
      className={`embed-object-frame${selected ? ' selected' : ''}${live ? ' live' : ''}${showFallback ? ' fallback' : ''}`}
      style={style}
    >
      {showPreview && plan.mode === 'iframe' && (
        <iframe
          title={obj.text || plan.label || 'Web embed'}
          src={plan.iframeSrc}
          loading="lazy"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts allow-popups allow-forms allow-presentation"
          allow="fullscreen"
          onLoad={() => setPreview('ready')}
          onError={() => setPreview('unavailable')}
        />
      )}

      {showPreview && plan.mode === 'image' && (
        <img
          className="embed-object-thumb"
          src={plan.imageSrc}
          alt=""
          draggable={false}
          onLoad={() => setPreview('ready')}
          onError={() => setPreview('unavailable')}
        />
      )}

      {showFallback && (
        <a
          className="embed-object-link-fallback"
          href={pageUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
          }}
        >
          <Globe size={22} strokeWidth={2} aria-hidden />
          <span className="embed-object-link-host">{plan.host}</span>
          <span className="embed-object-link-url">{pageUrl}</span>
          <span className="embed-object-link-cta">
            <ExternalLink size={14} strokeWidth={2.25} aria-hidden />
            Open link
          </span>
        </a>
      )}

      {!live && !showFallback && (
        <button
          type="button"
          className="embed-object-veil"
          tabIndex={0}
          aria-label={`Visit ${plan.host}`}
          onClick={(e) => {
            e.stopPropagation();
            onSelect();
            openEmbedUrl(pageUrl);
          }}
        >
          <span className="embed-object-open-label">
            <ExternalLink size={14} strokeWidth={2.25} aria-hidden />
            Visit link
          </span>
        </button>
      )}

      {selected && interactive && !live && showPreview && preview === 'ready' && (
        <button
          type="button"
          className="embed-object-interact"
          aria-label="Interact inside embed"
          onClick={(e) => {
            e.stopPropagation();
            onEnterLive();
          }}
        >
          Interact
        </button>
      )}

      {live && (
        <button
          type="button"
          className="embed-object-exit-live"
          onClick={(e) => {
            e.stopPropagation();
            onExitLive();
          }}
        >
          Done
        </button>
      )}
    </div>
  );
}
