import { Monitor, Moon, Sun } from 'lucide-react';
import { useLayoutEffect, useRef, useState } from 'react';
import { useThemeStore, type ThemePreference } from '../../stores/theme.store';
import { Tooltip } from './Tooltip';

const OPTIONS: Array<{ id: ThemePreference; label: string; icon: typeof Sun }> = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
];

type Props = {
  /** Icon-only chip (landing / boards header). */
  compact?: boolean;
  /** Full-width equal segments for menus and small screens. */
  stretch?: boolean;
};

export function ThemeSwitcher({ compact = false, stretch = false }: Props) {
  const { preference, setPreference } = useThemeStore();
  const rootRef = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState({ x: 0, width: 0, ready: false });
  const showLabels = !compact;

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const updateThumb = () => {
      const active = root.querySelector<HTMLElement>('.theme-opt[aria-checked="true"]');
      if (!active) return;
      const rootRect = root.getBoundingClientRect();
      const btnRect = active.getBoundingClientRect();
      setThumb({
        x: btnRect.left - rootRect.left,
        width: btnRect.width,
        ready: true,
      });
    };

    updateThumb();
    const ro = new ResizeObserver(updateThumb);
    ro.observe(root);
    for (const el of root.querySelectorAll('.theme-opt')) {
      ro.observe(el);
    }
    return () => ro.disconnect();
  }, [preference, compact, stretch, showLabels]);

  return (
    <div
      ref={rootRef}
      className={[
        'theme-switcher',
        compact ? 'theme-switcher-compact' : '',
        stretch ? 'theme-switcher-stretch' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="radiogroup"
      aria-label="Color theme"
    >
      <span
        className={`theme-switcher-thumb${thumb.ready ? ' ready' : ''}`}
        style={{
          width: thumb.width,
          transform: `translateX(${thumb.x}px)`,
        }}
        aria-hidden
      />
      {OPTIONS.map(({ id, label, icon: Icon }) => {
        const button = (
          <button
            type="button"
            role="radio"
            aria-checked={preference === id}
            className={`theme-opt ${preference === id ? 'active' : ''}`}
            aria-label={label}
            onClick={() => setPreference(id)}
          >
            <Icon size={compact && stretch ? 15 : 16} strokeWidth={2} aria-hidden />
            {showLabels && <span>{label}</span>}
          </button>
        );
        return (
          <span key={id} className="theme-opt-wrap">
            {compact ? (
              <Tooltip label={label} side="top">
                {button}
              </Tooltip>
            ) : (
              button
            )}
          </span>
        );
      })}
    </div>
  );
}
