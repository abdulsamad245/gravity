import { create } from 'zustand';
import { NO_FILL } from '../shared/constants/colors.constants';
import {
  DEFAULT_CONNECTOR_STYLE,
  type ConnectorStyle,
} from '../shared/constants/connector.constants';
import type { CanvasObject, CommentDraft, SharedTimerState, ToolId } from '../shared/types';

const CANVAS_BG_KEY = 'gravity.canvasBg';

function loadCanvasBg(): string | null {
  try {
    const v = localStorage.getItem(CANVAS_BG_KEY);
    if (!v || v === 'theme') return null;
    if (/^#[0-9a-fA-F]{6}$/.test(v)) return v;
  } catch {
    /* private mode */
  }
  return null;
}

/** Orbit / deep-link: open a toolbar or chrome flyout before spotlighting. */
export type ChromeRevealKind =
  | 'moreTools'
  | 'physics'
  | 'draw'
  | 'shapes'
  | 'shapesMore'
  | 'connect'
  | 'stickers'
  | 'colors'
  | 'charts'
  | 'resources'
  | 'facilitate'
  | 'templates'
  | 'moreMenu'
  | 'share';

export interface ChromeRevealRequest {
  kind: ChromeRevealKind;
  /** Bumps so the same kind can be requested again. */
  nonce: number;
}

interface UiState {
  tool: ToolId;
  selectedId: string | null;
  selectedIds: string[];
  fillColor: string;
  stampGlyph: string;
  /** When set, the stamp tool places this GIF/image URL instead of an emoji glyph. */
  stampGifSrc: string | null;
  followClientId: number | null;
  clipboard: CanvasObject[];
  boardGravity: boolean;
  /** Mirrored shared facilitation timer (from awareness LWW). */
  sharedTimer: SharedTimerState | null;
  /** Legacy end timestamp mirror for older call sites. */
  timerEndsAt: number | null;
  canvasBg: string | null;
  activeCommentId: string | null;
  commentDraft: CommentDraft | null;
  stickersFlyoutOpen: boolean;
  /** Preferred routing when placing a new object-linked connector. */
  connectorStyle: ConnectorStyle;
  /** Orbit “show me” asks chrome to open a flyout/menu. */
  chromeReveal: ChromeRevealRequest | null;
  setTool: (tool: ToolId) => void;
  setSelectedId: (id: string | null) => void;
  setSelectedIds: (ids: string[]) => void;
  toggleSelectedId: (id: string) => void;
  addSelectedIds: (ids: string[]) => void;
  setFillColor: (color: string) => void;
  setStampGlyph: (glyph: string) => void;
  setStampGifSrc: (src: string | null) => void;
  setFollowClientId: (id: number | null) => void;
  setClipboard: (objs: CanvasObject[]) => void;
  setBoardGravity: (on: boolean) => void;
  setSharedTimer: (timer: SharedTimerState | null) => void;
  setTimerEndsAt: (endsAt: number | null) => void;
  setCanvasBg: (bg: string | null) => void;
  setActiveCommentId: (id: string | null) => void;
  setCommentDraft: (draft: CommentDraft | null) => void;
  setStickersFlyoutOpen: (open: boolean) => void;
  setConnectorStyle: (style: ConnectorStyle) => void;
  requestChromeReveal: (kind: ChromeRevealKind) => void;
  clearChromeReveal: () => void;
}

/** Ephemeral UI state - never synced. canvasBg is persisted locally. */
export const useUiStore = create<UiState>((set, get) => ({
  tool: 'select',
  selectedId: null,
  selectedIds: [],
  fillColor: NO_FILL,
  stampGlyph: '⭐',
  stampGifSrc: null,
  followClientId: null,
  clipboard: [],
  boardGravity: false,
  sharedTimer: null,
  timerEndsAt: null,
  canvasBg: typeof window !== 'undefined' ? loadCanvasBg() : null,
  activeCommentId: null,
  commentDraft: null,
  stickersFlyoutOpen: false,
  connectorStyle: DEFAULT_CONNECTOR_STYLE,
  chromeReveal: null,
  setTool: (tool) => set({ tool, selectedId: null, selectedIds: [] }),
  setSelectedId: (selectedId) => set({ selectedId, selectedIds: selectedId ? [selectedId] : [] }),
  setSelectedIds: (selectedIds) => set({ selectedIds, selectedId: selectedIds[0] ?? null }),
  toggleSelectedId: (id) => {
    const cur = get().selectedIds;
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    // Keep the most recently toggled id as primary (toolbar / focus).
    set({ selectedIds: next, selectedId: next.includes(id) ? id : (next[next.length - 1] ?? null) });
  },
  /** Add ids to the selection without wiping existing ones (Orbit context / marquee). */
  addSelectedIds: (ids: string[]) => {
    const cur = get().selectedIds;
    const merged = [...cur];
    for (const id of ids) {
      if (!merged.includes(id)) merged.push(id);
    }
    set({ selectedIds: merged, selectedId: merged[merged.length - 1] ?? null });
  },
  setFillColor: (fillColor) => set({ fillColor }),
  setStampGlyph: (stampGlyph) => set({ stampGlyph, stampGifSrc: null }),
  setStampGifSrc: (stampGifSrc) => set({ stampGifSrc }),
  setFollowClientId: (followClientId) => set({ followClientId }),
  setClipboard: (clipboard) => set({ clipboard }),
  setBoardGravity: (boardGravity) => set({ boardGravity }),
  setSharedTimer: (sharedTimer) => set({ sharedTimer }),
  setTimerEndsAt: (timerEndsAt) => set({ timerEndsAt }),
  setCanvasBg: (canvasBg) => {
    try {
      if (canvasBg) localStorage.setItem(CANVAS_BG_KEY, canvasBg);
      else localStorage.setItem(CANVAS_BG_KEY, 'theme');
    } catch {
      /* ignore */
    }
    set({ canvasBg });
  },
  setActiveCommentId: (activeCommentId) => set({ activeCommentId, commentDraft: null }),
  setStickersFlyoutOpen: (stickersFlyoutOpen) => set({ stickersFlyoutOpen }),
  setConnectorStyle: (connectorStyle) => set({ connectorStyle }),
  setCommentDraft: (commentDraft) => set({ commentDraft, activeCommentId: null }),
  requestChromeReveal: (kind) =>
    set((s) => ({
      chromeReveal: { kind, nonce: (s.chromeReveal?.nonce ?? 0) + 1 },
    })),
  clearChromeReveal: () => set({ chromeReveal: null }),
}));
