import { Download, Share, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { APP_NAME, APP_TAGLINE } from '../../shared/constants/app.constants';
import { usePresence } from '../../shared/hooks/useOpenTransition';
import {
  readInstallDismissChrome,
  shouldIgnoreInstallEscape,
  shouldIgnoreInstallOutsideClick,
} from './install-prompt-dismiss';
import { type PwaInstallMode, usePwaInstall } from './usePwaInstall';

/**
 * Soft install card for the room workspace only (mounted from RoomPage).
 * Chromium: native install sheet. iOS: Add to Home Screen steps.
 * Dismiss: X, Not now, Escape (when nothing else owns the UI), or click the board canvas.
 * Closing Orbit / menus / the product tour must not snooze this card.
 */
export function InstallPrompt() {
  const { softMode, promptInstall, dismissSoft, closeSoftPrompt } = usePwaInstall();
  const [activeMode, setActiveMode] = useState<PwaInstallMode>(null);
  const [open, setOpen] = useState(false);
  const { mounted, className } = usePresence(open);
  const titleId = useId();
  const cardRef = useRef<HTMLElement>(null);
  const dismissSoftRef = useRef(dismissSoft);
  const closeSoftPromptRef = useRef(closeSoftPrompt);
  dismissSoftRef.current = dismissSoft;
  closeSoftPromptRef.current = closeSoftPrompt;

  useEffect(() => {
    if (softMode) {
      setActiveMode(softMode);
      setOpen(true);
      return;
    }
    setOpen(false);
  }, [softMode]);

  const close = (snooze: boolean) => {
    setOpen(false);
    if (snooze) dismissSoftRef.current();
    else closeSoftPromptRef.current();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (shouldIgnoreInstallEscape(readInstallDismissChrome())) return;
      e.stopPropagation();
      close(true);
    };
    const onPointer = (e: MouseEvent) => {
      const el = cardRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      if (shouldIgnoreInstallOutsideClick(e.target, readInstallDismissChrome())) return;
      close(true);
    };
    window.addEventListener('keydown', onKey, true);
    const t = window.setTimeout(() => {
      window.addEventListener('mousedown', onPointer);
    }, 0);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('mousedown', onPointer);
    };
  }, [open]);

  if (!mounted || !activeMode) return null;

  const onInstall = () => {
    void (async () => {
      await promptInstall();
      setOpen(false);
      closeSoftPromptRef.current();
    })();
  };

  return createPortal(
    <aside
      ref={cardRef}
      className={`pwa-install ${className}`}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="pwa-install-close"
        aria-label="Dismiss install prompt"
        onClick={() => close(true)}
      >
        <X size={16} strokeWidth={2.2} aria-hidden />
      </button>

      <div className="pwa-install-mark" aria-hidden>
        <img src="/pwa-192.png" width={48} height={48} alt="" draggable={false} />
      </div>

      <div className="pwa-install-copy">
        <h2 id={titleId} className="pwa-install-title">
          Install {APP_NAME}
        </h2>
        <p className="pwa-install-desc">
          {activeMode === 'ios'
            ? `Add ${APP_NAME} to your Home Screen for a full-screen app, faster launch, and offline boards.`
            : `${APP_TAGLINE} Open like a desktop app. Works offline. One tap to install.`}
        </p>

        {activeMode === 'ios' ? (
          <ol className="pwa-install-steps">
            <li>
              Tap <Share size={14} strokeWidth={2.2} aria-hidden className="pwa-install-share-icon" />{' '}
              Share
            </li>
            <li>Choose Add to Home Screen</li>
            <li>Tap Add</li>
          </ol>
        ) : null}
      </div>

      <div className="pwa-install-actions">
        {activeMode === 'native' ? (
          <button type="button" className="btn btn-primary" onClick={onInstall}>
            <Download size={14} strokeWidth={2.2} aria-hidden />
            Install app
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => close(false)}>
            Got it
          </button>
        )}
        <button type="button" className="btn btn-ghost pwa-install-later" onClick={() => close(true)}>
          Not now
        </button>
      </div>
    </aside>,
    document.body,
  );
}
