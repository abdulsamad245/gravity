import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import { GRAVITY } from '../../shared/constants/colors.constants';
import { useUiStore, type ChromeRevealKind } from '../../stores/ui.store';

/** Orbit “show me this control” — soft spotlight plus a compact tour-style label. */
export interface OrbitChromeGuide {
  /** Button label in the Orbit bubble, e.g. “Show Rope”. */
  label: string;
  /** CSS selector for the control to highlight. */
  selector: string;
  /** Open a flyout/menu first so the target is visible. */
  reveal?: ChromeRevealKind;
  /** Used when the primary selector is not mounted yet. */
  fallbackSelector?: string;
}

const SPOTLIGHT_DISMISS_MS = 7200;

let spotlightDriver: ReturnType<typeof driver> | null = null;
let dismissTimer: ReturnType<typeof setTimeout> | null = null;

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function findHighlightable(selector: string): Element | undefined {
  const nodes = document.querySelectorAll(selector);
  for (const el of nodes) {
    if ((el as HTMLElement).getClientRects().length > 0) return el;
  }
  return undefined;
}

function clearDismissTimer(): void {
  if (dismissTimer != null) {
    window.clearTimeout(dismissTimer);
    dismissTimer = null;
  }
}

/** Tear down a tool spotlight (does not affect the product tour). */
export function destroyChromeSpotlight(): void {
  clearDismissTimer();
  if (spotlightDriver) {
    const d = spotlightDriver;
    spotlightDriver = null;
    d.destroy();
  }
  document.body.classList.remove('gravity-spotlight-active');
}

function waitFrames(n: number): Promise<void> {
  return new Promise((resolve) => {
    const step = (left: number) => {
      if (left <= 0) resolve();
      else requestAnimationFrame(() => step(left - 1));
    };
    step(n);
  });
}

/** Strip the Orbit button verb so the floating tip reads as a place name. */
function spotlightTitle(guide: OrbitChromeGuide): string {
  const trimmed = guide.label.replace(/^Show\s+/i, '').trim();
  return trimmed || guide.label;
}

/** Prefer the roomier side so the label does not cover the control. */
function preferredSide(el: Element): 'left' | 'right' | 'top' | 'bottom' {
  const r = el.getBoundingClientRect();
  const spaceRight = window.innerWidth - r.right;
  const spaceLeft = r.left;
  const spaceBottom = window.innerHeight - r.bottom;
  const spaceTop = r.top;
  const minRoom = 140;

  if (spaceRight >= spaceLeft && spaceRight >= minRoom) return 'right';
  if (spaceLeft > spaceRight && spaceLeft >= minRoom) return 'left';
  if (spaceBottom >= spaceTop && spaceBottom >= 80) return 'bottom';
  if (spaceTop >= 80) return 'top';
  return spaceRight >= spaceLeft ? 'right' : 'left';
}

/**
 * Opens the needed chrome (if any), then spotlights the control with a ring and
 * compact label. No full-board dim (that felt like a modal flash). Click the
 * tool, the tip X, or wait a few seconds to dismiss.
 */
export async function showOrbitChromeGuide(guide: OrbitChromeGuide): Promise<boolean> {
  // Avoid stacking on the product tour (body class set by startProductTour).
  if (document.body.classList.contains('gravity-tour-active')) return false;

  destroyChromeSpotlight();

  if (guide.reveal) {
    useUiStore.getState().requestChromeReveal(guide.reveal);
  }

  await waitFrames(2);
  if (guide.reveal) {
    await new Promise<void>((r) => {
      window.setTimeout(r, 90);
    });
  }

  const el =
    findHighlightable(guide.selector) ??
    (guide.fallbackSelector ? findHighlightable(guide.fallbackSelector) : undefined);
  if (!el) return false;

  const reduced = prefersReducedMotion();
  const title = spotlightTitle(guide);
  document.body.classList.add('gravity-spotlight-active');

  spotlightDriver = driver({
    animate: !reduced,
    smoothScroll: !reduced,
    allowClose: true,
    // Transparent overlay: keep hit-target cutout behavior without darkening the board.
    overlayColor: GRAVITY.ink,
    overlayOpacity: 0,
    stagePadding: 10,
    stageRadius: 12,
    popoverOffset: 14,
    // Let the user click the highlighted control.
    disableActiveInteraction: false,
    overlayClickBehavior: () => {
      destroyChromeSpotlight();
    },
    showButtons: ['close'],
    doneBtnText: 'Got it',
    popoverClass: 'gravity-spotlight-popover',
    onPopoverRender: (popover) => {
      popover.closeButton.setAttribute('aria-label', 'Dismiss highlight');
      popover.closeButton.title = 'Dismiss';
      // Hide the unused done button; close (X) is enough for a one-shot tip.
      popover.nextButton.style.display = 'none';
      popover.previousButton.style.display = 'none';
      if (popover.footerButtons) {
        popover.footerButtons.style.display = 'none';
      }
    },
    onDestroyed: () => {
      spotlightDriver = null;
      document.body.classList.remove('gravity-spotlight-active');
      clearDismissTimer();
    },
  });

  spotlightDriver.highlight({
    element: el,
    popover: {
      title,
      description: 'Here. Tap it to use.',
      side: preferredSide(el),
      align: 'center',
      popoverClass: 'gravity-spotlight-popover',
    },
  });

  // Using the control clears the highlight so it does not feel stuck.
  el.addEventListener(
    'pointerdown',
    () => {
      destroyChromeSpotlight();
    },
    { once: true, capture: true },
  );

  dismissTimer = window.setTimeout(() => {
    destroyChromeSpotlight();
  }, SPOTLIGHT_DISMISS_MS);

  return true;
}
