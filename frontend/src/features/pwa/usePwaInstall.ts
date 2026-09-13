import { useSyncExternalStore } from 'react';
import {
  PWA_INSTALL_DISMISS_KEY,
  PWA_INSTALL_DISMISS_MS,
  PWA_INSTALL_SHOW_DELAY_MS,
} from './pwa.constants';

/** Chromium `beforeinstallprompt` (not in lib.dom yet everywhere). */
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export type PwaInstallMode = 'native' | 'ios' | null;

function isEmbedMode(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('embed') === '1';
  } catch {
    return false;
  }
}

/** True when running as an installed PWA / home-screen app. */
export function isPwaInstalled(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches
  );
}

export function isIosSafari(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const webkit = /WebKit/i.test(ua);
  const notOther = !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo/i.test(ua);
  return iOS && webkit && notOther;
}

function isDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(PWA_INSTALL_DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < PWA_INSTALL_DISMISS_MS;
  } catch {
    return false;
  }
}

export function dismissPwaInstallPrompt(): void {
  try {
    localStorage.setItem(PWA_INSTALL_DISMISS_KEY, String(Date.now()));
  } catch {
    /* private mode */
  }
}

type InstallSnapshot = {
  deferred: BeforeInstallPromptEvent | null;
  installed: boolean;
  dismissed: boolean;
  delayReady: boolean;
  /** Manual reopen of the soft card (e.g. from the toolbar Install control). */
  forceSoft: boolean;
};

let snapshot: InstallSnapshot = {
  deferred: null,
  installed: typeof window !== 'undefined' ? isPwaInstalled() : false,
  dismissed: typeof window !== 'undefined' ? isDismissedRecently() : false,
  delayReady: false,
  forceSoft: false,
};

const listeners = new Set<() => void>();
let bootstrapped = false;
let delayTimer: number | undefined;

function emit(): void {
  for (const listener of listeners) listener();
}

function patch(partial: Partial<InstallSnapshot>): void {
  snapshot = { ...snapshot, ...partial };
  emit();
}

function bootstrapInstallListeners(): void {
  if (bootstrapped || typeof window === 'undefined') return;
  bootstrapped = true;

  if (isEmbedMode() || snapshot.installed) {
    patch({ delayReady: true });
    return;
  }

  const onBip = (e: Event) => {
    e.preventDefault();
    patch({ deferred: e as BeforeInstallPromptEvent });
  };
  const onInstalled = () => {
    patch({ installed: true, deferred: null, forceSoft: false });
  };

  window.addEventListener('beforeinstallprompt', onBip);
  window.addEventListener('appinstalled', onInstalled);

  const mq = window.matchMedia('(display-mode: standalone)');
  const onDisplay = () => {
    if (isPwaInstalled()) patch({ installed: true, deferred: null, forceSoft: false });
  };
  mq.addEventListener?.('change', onDisplay);

  delayTimer = window.setTimeout(() => patch({ delayReady: true }), PWA_INSTALL_SHOW_DELAY_MS);
}

/**
 * Attach install listeners as early as possible (from `main.tsx`) so we do not
 * miss Chromium's one-shot `beforeinstallprompt` before React mounts.
 */
export function initPwaInstall(): void {
  bootstrapInstallListeners();
}

function subscribe(listener: () => void): () => void {
  bootstrapInstallListeners();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): InstallSnapshot {
  return snapshot;
}

function getServerSnapshot(): InstallSnapshot {
  return {
    deferred: null,
    installed: false,
    dismissed: false,
    delayReady: false,
    forceSoft: false,
  };
}

function installCapability(state: InstallSnapshot): PwaInstallMode {
  if (state.installed || isEmbedMode()) return null;
  if (state.deferred) return 'native';
  if (isIosSafari()) return 'ios';
  return null;
}

/**
 * Shared PWA install state. Soft prompt is room-only and snoozable;
 * the toolbar Install control stays available whenever the browser can install.
 */
export function usePwaInstall() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const capability = installCapability(state);

  /** Soft card: auto after delay (unless snoozed), or forced from the Install control. */
  const softMode: PwaInstallMode = (() => {
    if (!capability) return null;
    if (state.forceSoft) return capability;
    if (state.dismissed || !state.delayReady) return null;
    return capability;
  })();

  const promptInstall = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    const deferred = snapshot.deferred;
    if (!deferred) return 'unavailable';
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      patch({
        deferred: null,
        installed: outcome === 'accepted' ? true : snapshot.installed,
        forceSoft: false,
      });
      return outcome;
    } catch {
      patch({ deferred: null, forceSoft: false });
      return 'unavailable';
    }
  };

  const dismissSoft = () => {
    dismissPwaInstallPrompt();
    patch({ dismissed: true, forceSoft: false });
  };

  const openSoftPrompt = () => {
    if (!installCapability(snapshot)) return;
    patch({ forceSoft: true });
  };

  const closeSoftPrompt = () => {
    patch({ forceSoft: false });
  };

  return {
    /** Browser can offer install (native sheet or iOS A2HS). */
    available: capability !== null,
    capability,
    /** Soft card mode when auto-offer or manually opened. */
    softMode,
    installed: state.installed,
    promptInstall,
    dismissSoft,
    openSoftPrompt,
    closeSoftPrompt,
  };
}

/** Test helper: reset module state between unit tests if needed. */
export function __resetPwaInstallForTests(): void {
  if (delayTimer !== undefined) window.clearTimeout(delayTimer);
  delayTimer = undefined;
  bootstrapped = false;
  snapshot = {
    deferred: null,
    installed: typeof window !== 'undefined' ? isPwaInstalled() : false,
    dismissed: typeof window !== 'undefined' ? isDismissedRecently() : false,
    delayReady: false,
    forceSoft: false,
  };
  emit();
}
