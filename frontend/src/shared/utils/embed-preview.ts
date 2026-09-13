/**
 * Client-side embed preview hints. No server fetch of the target URL
 * (avoids SSRF). Known providers get playable iframe URLs; everything
 * else tries a sandboxed iframe and falls back to a link card in the UI.
 */

export type EmbedPreviewPlan =
  | {
      mode: 'iframe';
      /** Safer / embeddable URL for the iframe src. */
      iframeSrc: string;
      pageUrl: string;
      label: string;
      host: string;
    }
  | {
      mode: 'image';
      imageSrc: string;
      pageUrl: string;
      label: string;
      host: string;
    }
  | {
      mode: 'link';
      pageUrl: string;
      label: string;
      host: string;
    };

function displayHost(hostname: string): string {
  return hostname.replace(/^www\./i, '');
}

function shortLabel(url: URL): string {
  const host = displayHost(url.hostname);
  const path = url.pathname === '/' ? '' : url.pathname;
  const combined = `${host}${path}`;
  return combined.length > 48 ? `${combined.slice(0, 45)}…` : combined;
}

/** YouTube watch / youtu.be / shorts / embed → video id. */
export function extractYoutubeId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./i, '').toLowerCase();
  if (host === 'youtu.be') {
    const id = url.pathname.split('/').filter(Boolean)[0];
    return id && /^[\w-]{6,}$/.test(id) ? id : null;
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname.startsWith('/embed/')) {
      const id = url.pathname.split('/')[2];
      return id && /^[\w-]{6,}$/.test(id) ? id : null;
    }
    if (url.pathname.startsWith('/shorts/')) {
      const id = url.pathname.split('/')[2];
      return id && /^[\w-]{6,}$/.test(id) ? id : null;
    }
    const v = url.searchParams.get('v');
    return v && /^[\w-]{6,}$/.test(v) ? v : null;
  }
  return null;
}

/** Vimeo video id from common URL shapes. */
export function extractVimeoId(url: URL): string | null {
  const host = url.hostname.replace(/^www\./i, '').toLowerCase();
  if (host !== 'vimeo.com' && host !== 'player.vimeo.com') return null;
  const parts = url.pathname.split('/').filter(Boolean);
  if (host === 'player.vimeo.com' && parts[0] === 'video' && parts[1]) {
    return /^\d+$/.test(parts[1]) ? parts[1] : null;
  }
  const id = parts.find((p) => /^\d+$/.test(p));
  return id ?? null;
}

/**
 * Pick the best client-side preview plan for a validated page URL.
 */
export function planEmbedPreview(pageUrl: string): EmbedPreviewPlan {
  let url: URL;
  try {
    url = new URL(pageUrl);
  } catch {
    return { mode: 'link', pageUrl, label: pageUrl, host: 'link' };
  }

  const host = displayHost(url.hostname);
  const label = shortLabel(url);

  const yt = extractYoutubeId(url);
  if (yt) {
    return {
      mode: 'iframe',
      iframeSrc: `https://www.youtube-nocookie.com/embed/${yt}`,
      pageUrl,
      label: 'YouTube',
      host,
    };
  }

  const vimeo = extractVimeoId(url);
  if (vimeo) {
    return {
      mode: 'iframe',
      iframeSrc: `https://player.vimeo.com/video/${vimeo}`,
      pageUrl,
      label: 'Vimeo',
      host,
    };
  }

  // Try a sandboxed iframe first; the overlay falls back to a link card
  // if the frame errors or never loads (common with X-Frame-Options).
  return {
    mode: 'iframe',
    iframeSrc: pageUrl,
    pageUrl,
    label,
    host,
  };
}
