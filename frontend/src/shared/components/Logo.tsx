import { APP_NAME } from '../constants/app.constants';
import { useThemeStore } from '../../stores/theme.store';

/** Intrinsic pixel sizes of processed brand PNGs (after trim). */
const MARK_ASPECT = 454 / 320;
const LOCKUP_ASPECT = 784 / 185;

interface Props {
  /** Lockup / mark height in px. */
  size?: number;
  /** When false, only the planet mark is shown. Default true. */
  showWordmark?: boolean;
  /**
   * Accessible name. Defaults to APP_NAME — change the product name in
   * `app.constants.ts` (wordmark art still says Gravity until assets are re-exported).
   */
  name?: string;
  className?: string;
}

/**
 * Brand logo from the designed PNGs in `/public/brand/`.
 *
 * - **Mark** (`gravity-mark.png`): favicon, compact chrome, tight spaces.
 * - **Lockup** (`gravity-lockup*.png`): landing, boards, presence — mark + wordmark.
 *   Dark UI uses white wordmark; light UI uses `gravity-lockup-light.png`.
 */
export function Logo({ size = 28, showWordmark = true, name = APP_NAME, className }: Props) {
  const theme = useThemeStore((s) => s.resolved);

  if (!showWordmark) {
    const height = size;
    const width = Math.round(size * MARK_ASPECT);
    return (
      <span className={`brand-logo mark-only ${className ?? ''}`} aria-label={name} role="img">
        <img
          src="/brand/gravity-mark.png"
          width={width}
          height={height}
          alt=""
          draggable={false}
          className="brand-mark-img"
        />
      </span>
    );
  }

  const height = size;
  const width = Math.round(size * LOCKUP_ASPECT);
  // v=2: light lockup opens the “a” counter (was filled black on pale chrome).
  const src =
    theme === 'light' ? '/brand/gravity-lockup-light.png?v=2' : '/brand/gravity-lockup.png';

  return (
    <span className={`brand-logo has-wordmark ${className ?? ''}`} aria-label={name} role="img">
      <img
        src={src}
        width={width}
        height={height}
        alt=""
        draggable={false}
        className="brand-lockup-img"
      />
    </span>
  );
}
