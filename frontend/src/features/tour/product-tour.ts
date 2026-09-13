import { driver, type DriveStep, type Config } from 'driver.js';
import 'driver.js/dist/driver.css';
import { APP_NAME, ASSISTANT_NAME } from '../../shared/constants/app.constants';
import { GRAVITY } from '../../shared/constants/colors.constants';
import { destroyChromeSpotlight } from './chrome-spotlight';
import { PRODUCT_TOUR_STORAGE_KEY, PRODUCT_TOUR_VERSION } from './tour.constants';

export type TourStepId =
  | 'welcome'
  | 'boards'
  | 'toolbar'
  | 'sticky'
  | 'code'
  | 'stickers'
  | 'colors'
  | 'connect'
  | 'physics'
  | 'frame'
  | 'media'
  | 'moreTools'
  | 'gravity'
  | 'people'
  | 'templates'
  | 'facilitate'
  | 'orbit'
  | 'present'
  | 'replay'
  | 'more'
  | 'menu'
  | 'share'
  | 'zoom'
  | 'minimap'
  | 'done';

type PopoverSide = 'top' | 'right' | 'bottom' | 'left';
type PopoverAlign = 'start' | 'center' | 'end';

interface TourStepDef {
  id: TourStepId;
  /** CSS selector; omit for centered welcome / closing steps. */
  element?: string;
  title: string;
  description: string;
  side?: PopoverSide;
  align?: PopoverAlign;
}

/**
 * Full board chrome tour. Steps whose targets are hidden (e.g. desktop-only
 * controls on mobile) are dropped at runtime so the flow stays coherent.
 */
const STEPS: TourStepDef[] = [
  {
    id: 'welcome',
    title: `Welcome to ${APP_NAME}`,
    description:
      'Your infinite board. Drop ideas, connect them, throw with physics. Invite the room, present frames, replay the session. Skip anytime.',
  },
  {
    id: 'boards',
    element: '[data-tour="boards"]',
    title: 'Your room',
    description:
      'Click the title to rename this board. Use the rooms menu to jump to recent boards or open the full library at /rooms (Home, Recent, Starred).',
    side: 'bottom',
    align: 'start',
  },
  {
    id: 'toolbar',
    element: '[data-tour="toolbar"]',
    title: 'Left toolbar',
    description:
      'Everyday tools live here: select, hand, sticky, shapes (tables, mind maps, and Diagram under More shapes), text, code, draw, stickers, comment, connect, frame, physics, image, and voice note. Charts, resources, and embeds live under ··· More tools.',
    side: 'right',
    align: 'start',
  },
  {
    id: 'sticky',
    element: '[data-tour="sticky"]',
    title: 'Sticky notes',
    description:
      'Click Sticky note, then click the canvas to place one. Double-click a sticky to type. Select it for the floating text bar (size, bold, lists, link, highlight). With Physics on, flick to throw.',
    side: 'right',
    align: 'center',
  },
  {
    id: 'code',
    element: '[data-tour="code"]',
    title: 'Code blocks',
    description:
      'Place a collaborative code block. Pick language and font size; everyone in the room can edit with syntax highlighting.',
    side: 'right',
    align: 'center',
  },
  {
    id: 'stickers',
    element: '[data-tour="stickers"]',
    title: 'Stickers, emoji, GIFs',
    description:
      'Open the smiley for stickers, emoji, and GIFs. Facilitation also has sticker shortcuts; stamps and laser live under Draw (pencil).',
    side: 'right',
    align: 'center',
  },
  {
    id: 'colors',
    element: '[data-tour="colors"]',
    title: 'Fill color',
    description:
      'Pick a color before you place a shape or sticky. The active color applies to the next thing you add.',
    side: 'right',
    align: 'center',
  },
  {
    id: 'connect',
    element: '[data-tour="connect"]',
    title: 'Connectors',
    description:
      'Open Connect for straight, right-angle, curved, or polyline links. Click two objects to join them. You can change the style later from the selection bar.',
    side: 'right',
    align: 'center',
  },
  {
    id: 'physics',
    element: '[data-tour="physics"]',
    title: 'Physics tools',
    description:
      'Open Physics for Rope, Attract, Repel, Wind, Topic magnet, and Archive well. Select an object, turn Physics on, then flick to throw. Votes make cards heavier; locked objects stay pinned.',
    side: 'right',
    align: 'center',
  },
  {
    id: 'frame',
    element: '[data-tour="frame"]',
    title: 'Frames',
    description:
      'Drag a Frame to group content for Present mode (frames become slides). Shapes → Diagram adds an empty diagram frame with quick starts. Slide is also under ··· More tools → Other resources.',
    side: 'right',
    align: 'center',
  },
  {
    id: 'media',
    element: '[data-tour="media"]',
    title: 'Image and voice',
    description:
      'Image uploads a local picture. Voice note (mic) records audio onto the board. Paste or drop files when online; offline media uploads when you reconnect.',
    side: 'right',
    align: 'center',
  },
  {
    id: 'moreTools',
    element: '[data-tour="moreTools"]',
    title: 'More tools',
    description:
      'Web embed (live preview when the site allows it), Charts (bars, pie, scatter, radar, and more), and Other resources (video, audio, table, PDF, files). Tables switch between Table, Kanban, and Timeline views.',
    side: 'right',
    align: 'center',
  },
  {
    id: 'gravity',
    element: '[data-tour="gravity"]',
    title: 'Board gravity',
    description:
      'Turn Gravity on so loose physics objects fall and stack for everyone in the room. Pair it with magnets, wind, or an archive well to sort the pile. Turn it off when you want things to stay put.',
    side: 'top',
    align: 'start',
  },
  {
    id: 'people',
    element: '[data-tour="people"]',
    title: 'Who is here',
    description:
      'Avatars update live. Click yours to edit username, color, or photo (username can auto-generate). Click someone else to follow their view. Connection status sits next to the group.',
    side: 'bottom',
    align: 'center',
  },
  {
    id: 'templates',
    element: '[data-tour="templates"]',
    title: 'Templates',
    description:
      'Drop in a ready workshop layout: brainstorm, affinity, SWOT, journey, kanban, sprint, lean coffee, flowchart, and more. You can still edit everything after.',
    side: 'bottom',
    align: 'start',
  },
  {
    id: 'facilitate',
    element: '[data-tour="facilitate"]',
    title: 'Facilitate',
    description:
      'Shared timer (presets, pause, add time, optional music), hidden-ballot voting with optional timer and anonymous results (Voting chip while open; I\'m done progress), private brainstorm, reactions, raise hand, sticker shortcuts, and Board physics (Shake, Settle, magnets, archive wells).',
    side: 'bottom',
    align: 'end',
  },
  {
    id: 'orbit',
    element: '[data-tour="orbit"]',
    title: ASSISTANT_NAME,
    description: `${ASSISTANT_NAME} is your board agent. Ask it to build a layout, edit stickies, open a template, cluster ideas, or explain where a tool lives. Attach documents for text excerpts. Use New chat / History in the dock, and Show me in how-to replies to spotlight a control with a short label.`,
    side: 'bottom',
    align: 'end',
  },
  {
    id: 'present',
    element: '[data-tour="present"]',
    title: 'Present frames',
    description:
      'Add Frame objects, then Present to show them as slides (keyboard nav, slide overview). Record an optional talktrack with the mic and download a WebM when you are done.',
    side: 'bottom',
    align: 'end',
  },
  {
    id: 'replay',
    element: '[data-tour="replay"]',
    title: 'Session replay',
    description:
      'Watch how this board was built, step by step. Rewind or fast-forward (arrows / J / L), change playback speed, then export session history or a video from the replay bar. You can Exit replay and keep editing while WebM encodes; Hide the progress card, leave this tab open, and a toast (or desktop notification) fires when the download is ready.',
    side: 'bottom',
    align: 'end',
  },
  {
    id: 'more',
    element: '[data-tour="more"]',
    title: 'More actions',
    description:
      'Take a tour again, Install the app (PWA when available), Import board (JSON), Open session history, export PNG / SVG / JSON, Theme (light / dark / system), and canvas background.',
    side: 'bottom',
    align: 'end',
  },
  {
    id: 'menu',
    element: '[data-tour="menu"]',
    title: 'Board menu',
    description: `On smaller screens, open this menu for Share, Templates, Take a tour, Install, ${ASSISTANT_NAME}, Present, Replay, theme, and export.`,
    side: 'bottom',
    align: 'end',
  },
  {
    id: 'share',
    element: '[data-tour="share"]',
    title: 'Share the room',
    description:
      'Copy an invite link, or send invites by email. The room creator can paste a Meet, Zoom, Discord, Teams, Whereby, Webex, Jitsi, or Skype link under Live call (email invites include it when set). Grab an iframe embed snippet for another site. Join call appears next to Share when a call link is set.',
    side: 'bottom',
    align: 'end',
  },
  {
    id: 'zoom',
    element: '[data-tour="zoom"]',
    title: 'Zoom and undo',
    description:
      'Zoom in or out, click the percent for 100%, or Fit to frame everything. Undo and redo sit in the pill below. Tip: hold Space to pan. Right-click the board or an object for more actions.',
    side: 'right',
    align: 'end',
  },
  {
    id: 'minimap',
    element: '[data-tour="minimap"]',
    title: 'Minimap radar',
    description:
      'See the whole board and other people\'s viewports. Click anywhere on the minimap to jump the camera there. It eases aside when Orbit is open.',
    side: 'left',
    align: 'end',
  },
  {
    id: 'done',
    title: 'You are ready',
    description:
      'Try physics: throw stickies, place a Topic magnet, then Settle from Facilitate. Or open ··· More tools for a chart or embed. Ask Orbit to build a starter board. Reopen this tour anytime from More → Take a tour.',
  },
];

let activeDriver: ReturnType<typeof driver> | null = null;

export function hasCompletedProductTour(): boolean {
  try {
    return localStorage.getItem(PRODUCT_TOUR_STORAGE_KEY) === PRODUCT_TOUR_VERSION;
  } catch {
    return true;
  }
}

export function markProductTourCompleted(): void {
  try {
    localStorage.setItem(PRODUCT_TOUR_STORAGE_KEY, PRODUCT_TOUR_VERSION);
  } catch {
    /* private mode */
  }
}

export function isProductTourActive(): boolean {
  return !!activeDriver?.isActive();
}

function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function findHighlightable(selector: string): Element | undefined {
  const nodes = document.querySelectorAll(selector);
  for (const el of nodes) {
    // Skip targets hidden by responsive chrome (e.g. desktop actions on mobile).
    if ((el as HTMLElement).getClientRects().length > 0) return el;
  }
  return undefined;
}

function buildSteps(): DriveStep[] {
  const out: DriveStep[] = [];
  for (const step of STEPS) {
    if (!step.element) {
      out.push({
        popover: {
          title: step.title,
          description: step.description,
          popoverClass: 'gravity-tour-popover',
        },
      });
      continue;
    }
    const el = findHighlightable(step.element);
    if (!el) continue;
    out.push({
      element: el,
      popover: {
        title: step.title,
        description: step.description,
        side: step.side,
        align: step.align,
        popoverClass: 'gravity-tour-popover',
      },
    });
  }
  return out;
}

export interface StartProductTourOptions {
  /** Restart even if the user already finished the tour. */
  force?: boolean;
  onDestroyed?: () => void;
}

/**
 * Starts the board product tour. Safe to call when chrome may be missing:
 * steps without a matching element are skipped.
 */
export function startProductTour(options: StartProductTourOptions = {}): boolean {
  if (!options.force && hasCompletedProductTour()) return false;
  if (activeDriver?.isActive()) {
    if (!options.force) return false;
    activeDriver.destroy();
  }
  // Tool spotlights from Orbit must not stack under the full tour.
  destroyChromeSpotlight();

  const steps = buildSteps();
  if (steps.length === 0) return false;

  const reduced = prefersReducedMotion();
  const onDestroyedCb = options.onDestroyed;

  const config: Config = {
    steps,
    showProgress: true,
    animate: !reduced,
    smoothScroll: !reduced,
    allowClose: true,
    // Soft scrim so the board reads as disabled; spotlight cutout stays clear.
    // Outside clicks must not dismiss — only Skip, X, or finishing the tour.
    overlayClickBehavior: () => {
      /* keep tour open */
    },
    disableActiveInteraction: true,
    overlayColor: GRAVITY.ink,
    overlayOpacity: 0.34,
    stagePadding: 12,
    stageRadius: 14,
    popoverOffset: 14,
    showButtons: ['next', 'previous', 'close'],
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: 'Start creating',
    progressText: '{{current}} of {{total}}',
    onPopoverRender: (popover) => {
      popover.closeButton.setAttribute('aria-label', 'Skip tour');
      popover.closeButton.title = 'Skip tour';

      const footer = popover.footer;
      if (!footer || footer.querySelector('[data-tour-skip]')) return;

      const skip = document.createElement('button');
      skip.type = 'button';
      skip.dataset.tourSkip = '1';
      skip.className = 'gravity-tour-skip';
      skip.textContent = 'Skip tour';
      skip.setAttribute('aria-label', 'Skip tour');
      skip.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        activeDriver?.destroy();
      });
      // Keep Skip on the same row as Back / Next (progress sits on its own row via CSS).
      const nav = popover.footerButtons;
      if (nav?.parentElement === footer) {
        footer.insertBefore(skip, nav);
      } else {
        footer.appendChild(skip);
      }
    },
    onDestroyStarted: () => {
      markProductTourCompleted();
      activeDriver?.destroy();
    },
    onDestroyed: () => {
      activeDriver = null;
      document.body.classList.remove('gravity-tour-active');
      onDestroyedCb?.();
    },
  };

  document.body.classList.add('gravity-tour-active');
  activeDriver = driver(config);
  activeDriver.drive();
  return true;
}

export function destroyProductTour(): void {
  activeDriver?.destroy();
}
