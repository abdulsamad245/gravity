import { API_BASE_URL, MEDIA_API_PATH } from '../constants/app.constants';

/**
 * Resolve durable `/api/v1/media/...` refs for display and playback.
 * Prefers same-origin paths; rewrites absolute API media URLs to a path when
 * the current page can serve `/api` (Vite proxy or Nginx).
 */
export function resolveMediaUrl(src: string | undefined | null): string {
  if (!src) return '';
  if (src.startsWith('data:') || src.startsWith('blob:')) return src;

  if (src.startsWith('http://') || src.startsWith('https://')) {
    try {
      const u = new URL(src);
      if (u.pathname.startsWith(`${MEDIA_API_PATH}/`) && typeof window !== 'undefined') {
        // Prefer same-origin so <img> is not blocked by CORP on the API host.
        return u.pathname + u.search;
      }
    } catch {
      /* keep absolute */
    }
    return src;
  }

  if (src.startsWith('/api/')) {
    if (API_BASE_URL) return `${API_BASE_URL}${src}`;
    return src;
  }
  return src;
}
