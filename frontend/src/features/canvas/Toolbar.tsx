import type { LucideIcon } from 'lucide-react';
import {
  AppWindow,
  ArrowBigRight,
  ArrowRight,
  BarChart3,
  Cable,
  ChevronRight,
  Circle,
  CircleDot,
  Code2,
  CornerDownRight,
  Diamond,
  Ellipsis,
  Eraser,
  FolderOpen,
  Frame,
  Hand,
  Highlighter,
  ImagePlus,
  Link2,
  Archive,
  Magnet,
  MessageCircle,
  Mic,
  Minus,
  MousePointer2,
  Orbit,
  Pencil,
  PenLine,
  Pipette,
  Shapes,
  SmilePlus,
  Spline,
  Square,
  Stamp,
  StickyNote,
  Target,
  Triangle,
  Type,
  Wand2,
  Wind,
  Workflow,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { nanoid } from 'nanoid';
import { Tooltip } from '../../shared/components/Tooltip';
import { APP_NAME } from '../../shared/constants/app.constants';
import { DEFAULTS, OBJECT_ID_LENGTH } from '../../shared/constants/canvas.constants';
import { GRAVITY, isNoFill, NO_FILL, OBJECT_COLORS, PALETTE_SWATCHES } from '../../shared/constants/colors.constants';
import {
  CONNECTOR_STYLE_LABELS,
  type ConnectorStyle,
} from '../../shared/constants/connector.constants';
import type { ToolId } from '../../shared/types';
import { dialogAlert, dialogPrompt } from '../../shared/components/DialogHost';
import { screenToWorld, useViewStore } from '../../stores/view.store';
import { useUiStore } from '../../stores/ui.store';
import type { RoomConnection } from '../collaboration/RoomConnection';
import { colorPatchForObject } from '../../shared/utils/object-style';
import { EMBED_URL_PROMPT, validateEmbedUrl } from '../../shared/utils/validate-embed-url';
import { VoteMenu } from './VoteMenu';
import { fileToImageObject } from '../media/image-utils';
import { persistDataUrl } from '../media/persist-media';
import { useAudioRecorder } from '../media/useAudioRecorder';
import { VoiceRecordStrip } from '../media/VoiceRecordStrip';
import { toggleBoardGravity } from '../physics/useBoardGravitySync';
import { ChartsPanel } from './ChartsPanel';
import { MoreShapesPanel } from './MoreShapesPanel';
import { ResourcesPanel } from './ResourcesPanel';
import { StickersFlyout } from './StickersFlyout';

function embedUrlPromptValidate(value: string): string | null {
  const checked = validateEmbedUrl(value);
  return checked.ok ? null : checked.error;
}

interface ToolItem {
  id: ToolId;
  icon: LucideIcon;
  label: string;
  key?: string;
}

type FlyoutRow =
  | { kind: 'tool'; item: ToolItem }
  | { kind: 'sep' }
  | { kind: 'more' }
  | { kind: 'diagram' };

interface ToolCategory {
  id: string;
  icon: LucideIcon;
  label: string;
  tool?: ToolId;
  items?: ToolItem[];
  flyout?: FlyoutRow[];
  /** Connector style picker (Straight / Right angle / …). */
  connectors?: boolean;
  panel?: 'stickers' | 'charts' | 'resources';
}

const CONNECTOR_STYLE_ITEMS: { style: ConnectorStyle; icon: LucideIcon; label: string; key?: string }[] = [
  { style: 'straight', icon: Link2, label: CONNECTOR_STYLE_LABELS.straight, key: 'C' },
  { style: 'elbow', icon: CornerDownRight, label: CONNECTOR_STYLE_LABELS.elbow },
  { style: 'curved', icon: Spline, label: CONNECTOR_STYLE_LABELS.curved },
  { style: 'polyline', icon: Workflow, label: CONNECTOR_STYLE_LABELS.polyline },
];

const SHAPE_MAIN: FlyoutRow[] = [
  { kind: 'tool', item: { id: 'line', icon: Minus, label: 'Line', key: 'L' } },
  { kind: 'tool', item: { id: 'arrow', icon: ArrowRight, label: 'Arrow' } },
  { kind: 'tool', item: { id: 'elbowArrow', icon: CornerDownRight, label: 'Elbow arrow' } },
  { kind: 'tool', item: { id: 'blockArrow', icon: ArrowBigRight, label: 'Block arrow' } },
  { kind: 'sep' },
  { kind: 'tool', item: { id: 'rect', icon: Square, label: 'Rectangle', key: 'R' } },
  { kind: 'tool', item: { id: 'ellipse', icon: Circle, label: 'Oval', key: 'O' } },
  { kind: 'tool', item: { id: 'diamond', icon: Diamond, label: 'Rhombus', key: '2' } },
  { kind: 'tool', item: { id: 'triangle', icon: Triangle, label: 'Triangle', key: '1' } },
  { kind: 'sep' },
  { kind: 'tool', item: { id: 'divider', icon: Minus, label: 'Divider' } },
  { kind: 'more' },
  { kind: 'sep' },
  { kind: 'diagram' },
];

/** Physics tools shown in the primary-rail flyout. */
const PHYSICS_TOOLS: ToolItem[] = [
  { id: 'rope', icon: Cable, label: 'Rope', key: 'G' },
  { id: 'attract', icon: Magnet, label: 'Attract', key: 'A' },
  { id: 'repel', icon: CircleDot, label: 'Repel', key: 'X' },
  { id: 'wind', icon: Wind, label: 'Wind', key: 'W' },
  { id: 'magnet', icon: Target, label: 'Topic magnet', key: 'J' },
  { id: 'archiveWell', icon: Archive, label: 'Archive well', key: 'Z' },
];

/**
 * Primary rail: core tools, Connect, Physics, image, voice note.
 * Charts, embeds, and resources are under ··· More.
 */
const CATEGORIES: ToolCategory[] = [
  { id: 'select', icon: MousePointer2, label: 'Select', tool: 'select' },
  { id: 'hand', icon: Hand, label: 'Hand', tool: 'hand' },
  { id: 'sticky', icon: StickyNote, label: 'Sticky note', tool: 'sticky' },
  {
    id: 'shapes',
    icon: Shapes,
    label: 'Shapes',
    flyout: SHAPE_MAIN,
  },
  { id: 'text', icon: Type, label: 'Text', tool: 'text' },
  { id: 'code', icon: Code2, label: 'Code block', tool: 'code' },
  {
    id: 'draw',
    icon: Pencil,
    label: 'Draw',
    items: [
      { id: 'pen', icon: Pencil, label: 'Pen', key: 'P' },
      { id: 'highlighter', icon: Highlighter, label: 'Highlighter', key: 'U' },
      { id: 'eraser', icon: Eraser, label: 'Eraser', key: 'E' },
      { id: 'laser', icon: PenLine, label: 'Laser', key: 'K' },
      { id: 'stamp', icon: Stamp, label: 'Stamp', key: 'M' },
    ],
  },
  { id: 'stickers', icon: SmilePlus, label: 'Stickers, Emoji and GIFs', panel: 'stickers' },
  { id: 'comment', icon: MessageCircle, label: 'Comment', tool: 'comment' },
  { id: 'connect', icon: Link2, label: 'Connect', connectors: true },
  { id: 'frame', icon: Frame, label: 'Frame', tool: 'frame' },
  {
    id: 'physics',
    icon: Magnet,
    label: 'Physics',
    items: PHYSICS_TOOLS,
  },
];

/** Create tools tucked into ··· More (not on the primary rail). */
const MORE_CREATE_TOOLS: ToolItem[] = [
  { id: 'embed', icon: AppWindow, label: 'Web embed' },
];

const MORE_TOOL_IDS = new Set<ToolId>(['chart', ...MORE_CREATE_TOOLS.map((t) => t.id)]);

const PHYSICS_TOOL_IDS = new Set<ToolId>(PHYSICS_TOOLS.map((t) => t.id));

const SHAPE_TOOL_IDS = new Set<ToolId>([
  'line',
  'arrow',
  'elbowArrow',
  'blockArrow',
  'rect',
  'ellipse',
  'diamond',
  'triangle',
  'divider',
  'star',
  'hexagon',
  'table',
]);

function categoryOwnsTool(cat: ToolCategory, tool: ToolId): boolean {
  if (cat.tool === tool) return true;
  if (cat.connectors && tool === 'connector') return true;
  if (cat.id === 'physics' && PHYSICS_TOOL_IDS.has(tool)) return true;
  if (cat.id === 'shapes' && SHAPE_TOOL_IDS.has(tool)) return true;
  return !!cat.items?.some((i) => i.id === tool);
}

function moreOwnsTool(tool: ToolId): boolean {
  return MORE_TOOL_IDS.has(tool);
}

function normalizeHex(c: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(c)) return c;
  return GRAVITY.flare;
}

interface Props {
  conn: RoomConnection;
  objectsCount: number;
}

export function Toolbar({ conn }: Props) {
  const {
    tool,
    setTool,
    fillColor,
    setFillColor,
    selectedId,
    selectedIds,
    setSelectedId,
    boardGravity,
    stickersFlyoutOpen,
    setStickersFlyoutOpen,
    connectorStyle,
    setConnectorStyle,
    chromeReveal,
  } = useUiStore();
  const [openCat, setOpenCat] = useState<string | null>(null);
  const [moreShapes, setMoreShapes] = useState(false);
  const [moreToolsOpen, setMoreToolsOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [gravityTucked, setGravityTucked] = useState(false);
  const gravityDockRef = useRef<HTMLDivElement>(null);

  const closeOverlays = () => {
    setOpenCat(null);
    setMoreShapes(false);
    setMoreToolsOpen(false);
    setColorOpen(false);
  };

  const pickConnectorStyle = (style: ConnectorStyle) => {
    setConnectorStyle(style);
    setTool('connector');
    closeOverlays();
  };

  useEffect(() => {
    if (!stickersFlyoutOpen) return;
    setColorOpen(false);
    setMoreShapes(false);
    setMoreToolsOpen(false);
    setOpenCat('stickers');
    setStickersFlyoutOpen(false);
  }, [stickersFlyoutOpen, setStickersFlyoutOpen]);

  /** Orbit “Show me” opens the right flyout before spotlighting a control. */
  useEffect(() => {
    if (!chromeReveal) return;
    const { kind } = chromeReveal;
    if (
      kind === 'facilitate' ||
      kind === 'templates' ||
      kind === 'moreMenu' ||
      kind === 'share'
    ) {
      return;
    }
    setColorOpen(false);
    setMoreShapes(false);
    setMoreToolsOpen(false);
    setOpenCat(null);
    if (kind === 'moreTools') setMoreToolsOpen(true);
    else if (kind === 'physics') setOpenCat('physics');
    else if (kind === 'draw') setOpenCat('draw');
    else if (kind === 'shapes') setOpenCat('shapes');
    else if (kind === 'shapesMore') {
      setOpenCat('shapes');
      setMoreShapes(true);
    } else if (kind === 'connect') setOpenCat('connect');
    else if (kind === 'stickers') setOpenCat('stickers');
    else if (kind === 'colors') setColorOpen(true);
    else if (kind === 'charts') setOpenCat('charts');
    else if (kind === 'resources') setOpenCat('resources');
  }, [chromeReveal]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);

  const pickFill = (c: string, close = false) => {
    setFillColor(c);
    const ids = selectedIds.length ? selectedIds : selectedId ? [selectedId] : [];
    for (const id of ids) {
      const obj = conn.getObject(id);
      if (!obj) continue;
      const patch = colorPatchForObject(obj, c);
      if (Object.keys(patch).length) conn.updateObject(id, patch);
    }
    if (close) setColorOpen(false);
  };

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      // Keep flyouts open while Orbit is spotlighting a control.
      if (document.body.classList.contains('gravity-spotlight-active')) return;
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        closeOverlays();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (moreShapes) setMoreShapes(false);
        else closeOverlays();
      }
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [moreShapes]);

  // Place flyouts in the viewport. Show full menu height when it fits; only choose
  // open-up vs open-down from available space (and clamp height as a last resort).
  useLayoutEffect(() => {
    const el = flyoutRef.current;
    if (!el || (!openCat && !colorOpen && !moreToolsOpen)) return;

    const clearInline = () => {
      el.style.position = '';
      el.style.left = '';
      el.style.right = '';
      el.style.top = '';
      el.style.bottom = '';
      el.style.marginTop = '';
      el.style.maxHeight = '';
      el.style.overflowY = '';
      el.style.transform = '';
      el.style.translate = '';
      el.classList.remove('flyout-open-up', 'flyout-open-down', 'toolbar-flyout-fixed');
    };

    // Bottom toolbar rail (narrow viewports). Absolute CSS flyouts get clipped by
    // `.toolbar { overflow-y: hidden }`, so we still use fixed placement there.
    const mobileMq = window.matchMedia('(max-width: 640px)');
    const anchor = el.parentElement;
    if (!anchor) return;

    const place = () => {
      // Never fight the product tour spotlight / popovers.
      if (document.body.classList.contains('gravity-tour-active')) {
        clearInline();
        return;
      }

      const pad = 12;
      const gap = 10;
      const vh = window.innerHeight;
      const vw = window.innerWidth;
      const mobile = mobileMq.matches;
      const anchorRect = anchor.getBoundingClientRect();

      // Measure natural content size (no height clamp). Escape toolbar overflow.
      el.classList.add('toolbar-flyout-fixed');
      el.style.position = 'fixed';
      el.style.transform = 'none';
      el.style.translate = 'none';
      el.style.marginTop = '0px';
      el.style.maxHeight = 'none';
      el.style.overflowY = 'visible';
      el.style.left = mobile
        ? `${Math.max(pad, Math.min(anchorRect.left, vw - 280))}px`
        : `${Math.min(anchorRect.right + gap, vw - 280)}px`;
      el.style.top = '0px';
      el.style.bottom = 'auto';
      el.classList.add('flyout-open-down');
      el.classList.remove('flyout-open-up');
      void el.offsetHeight;

      const measured = el.getBoundingClientRect();
      const contentH = measured.height;
      const menuWidth = measured.width || 240;

      if (mobile) {
        // Bottom rail: always open above the trigger so items stay on-screen.
        const spaceAbove = Math.max(0, anchorRect.top - gap - pad);
        el.classList.remove('flyout-open-down');
        el.classList.add('flyout-open-up');
        el.style.top = 'auto';
        el.style.bottom = `${Math.round(Math.max(pad, vh - anchorRect.top + gap))}px`;

        const idealLeft = anchorRect.left + anchorRect.width / 2 - menuWidth / 2;
        el.style.left = `${Math.round(
          Math.min(Math.max(pad, idealLeft), Math.max(pad, vw - pad - menuWidth)),
        )}px`;

        if (contentH > spaceAbove) {
          el.style.maxHeight = `${Math.floor(Math.max(140, spaceAbove))}px`;
          el.style.overflowY = 'auto';
        } else {
          el.style.maxHeight = 'none';
          el.style.overflowY = 'visible';
        }
        return;
      }

      // Room when top-aligned (open down) vs bottom-aligned (open up).
      const spaceBelow = Math.max(0, vh - pad - anchorRect.top);
      const spaceAbove = Math.max(0, anchorRect.bottom - pad);
      const fitsBelow = contentH <= spaceBelow + 0.5;
      const fitsAbove = contentH <= spaceAbove + 0.5;

      let openUp: boolean;
      if (fitsBelow !== fitsAbove) {
        // Prefer the side that can show every item without scrolling.
        openUp = fitsAbove;
      } else {
        // Both fit or neither fits — open toward the side with more room.
        openUp = spaceAbove > spaceBelow;
      }

      const available = openUp ? spaceAbove : spaceBelow;
      if (contentH > available) {
        el.style.maxHeight = `${Math.floor(Math.max(140, available))}px`;
        el.style.overflowY = 'auto';
      } else {
        el.style.maxHeight = 'none';
        el.style.overflowY = 'visible';
      }

      const left = Math.min(Math.max(pad, anchorRect.right + gap), Math.max(pad, vw - pad - menuWidth));
      el.style.left = `${Math.round(left)}px`;

      if (openUp) {
        el.classList.remove('flyout-open-down');
        el.classList.add('flyout-open-up');
        el.style.top = 'auto';
        el.style.bottom = `${Math.round(Math.max(pad, vh - anchorRect.bottom))}px`;
      } else {
        el.classList.remove('flyout-open-up');
        el.classList.add('flyout-open-down');
        el.style.bottom = 'auto';
        el.style.top = `${Math.round(Math.max(pad, anchorRect.top))}px`;
      }

      // Keep fully on-screen if chrome or DPI still clips an edge.
      const rect = el.getBoundingClientRect();
      if (rect.top < pad) {
        el.style.top = `${pad}px`;
        el.style.bottom = 'auto';
        el.style.maxHeight = `${Math.floor(vh - pad * 2)}px`;
        el.style.overflowY = 'auto';
      } else if (rect.bottom > vh - pad) {
        el.style.maxHeight = `${Math.floor(Math.max(120, vh - pad - rect.top))}px`;
        el.style.overflowY = 'auto';
      }
    };

    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    mobileMq.addEventListener('change', place);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
      mobileMq.removeEventListener('change', place);
      clearInline();
    };
  }, [openCat, moreShapes, colorOpen, moreToolsOpen]);

  // Selection chrome lives on the canvas under HTML. Tuck Gravity when it would cover it.
  useLayoutEffect(() => {
    const dock = gravityDockRef.current;
    if (!dock) return;

    const ids = selectedIds.length ? selectedIds : selectedId ? [selectedId] : [];
    if (ids.length === 0) {
      setGravityTucked(false);
      return;
    }

    const pad = 10;
    const check = () => {
      const view = useViewStore.getState();
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const id of ids) {
        const o = conn.getObject(id);
        if (!o) continue;
        const left = o.x * view.scale + view.x;
        const top = o.y * view.scale + view.y;
        const right = left + o.width * view.scale;
        const bottom = top + o.height * view.scale;
        minX = Math.min(minX, left);
        minY = Math.min(minY, top);
        maxX = Math.max(maxX, right);
        maxY = Math.max(maxY, bottom);
      }
      if (!Number.isFinite(minX)) {
        setGravityTucked(false);
        return;
      }
      // Include transformer anchors outside the object box.
      const sel = {
        left: minX - pad,
        top: minY - pad,
        right: maxX + pad,
        bottom: maxY + pad,
      };
      const g = dock.getBoundingClientRect();
      const overlaps =
        sel.left < g.right && sel.right > g.left && sel.top < g.bottom && sel.bottom > g.top;
      setGravityTucked(overlaps);
    };

    let raf = 0;
    const tick = () => {
      check();
      raf = window.requestAnimationFrame(tick);
    };
    tick();
    window.addEventListener('resize', check);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', check);
    };
  }, [conn, selectedId, selectedIds]);

  const viewportCenter = () => {
    const view = useViewStore.getState();
    return screenToWorld(view, window.innerWidth / 2, window.innerHeight / 2);
  };

  const recorder = useAudioRecorder((dataUrl, seconds) => {
    const center = viewportCenter();
    const id = nanoid(OBJECT_ID_LENGTH);
    void (async () => {
      const audio = await persistDataUrl(dataUrl, 'audio/webm');
      conn.addObject({
        id,
        type: 'audio',
        x: center.x - DEFAULTS.audio.width / 2,
        y: center.y - DEFAULTS.audio.height / 2,
        width: DEFAULTS.audio.width,
        height: DEFAULTS.audio.height,
        rotation: 0,
        fill: '#f3f4f7',
        stroke: GRAVITY.flare,
        strokeWidth: 2,
        audio,
        audioDuration: seconds,
        z: conn.nextZ(),
        createdBy: conn.identity.id,
      });
    })();
  });

  const handleImageFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      const obj = await fileToImageObject(file, viewportCenter(), conn.nextZ(), conn.identity.id);
      if (obj) conn.addObject(obj);
    }
  };

  const selected = selectedId ? conn.getObject(selectedId) : undefined;
  const multi = selectedIds.length > 1;

  const placeWebEmbed = async () => {
    const raw = await dialogPrompt(EMBED_URL_PROMPT, '', 'Web embed', {
      confirmLabel: 'Add',
      validate: embedUrlPromptValidate,
    });
    if (raw == null) return;
    const checked = validateEmbedUrl(raw);
    if (!checked.ok) return;
    const center = viewportCenter();
    const { width, height } = DEFAULTS.embed;
    const id = nanoid(OBJECT_ID_LENGTH);
    conn.addObject({
      id,
      type: 'embed',
      text: 'Web embed',
      src: checked.href,
      x: center.x - width / 2,
      y: center.y - height / 2,
      width,
      height,
      rotation: 0,
      fill: '#1c1f28',
      stroke: '#5b6478',
      strokeWidth: 1.5,
      z: conn.nextZ(),
      createdBy: conn.identity.id,
    });
    setSelectedId(id);
    setTool('select');
    closeOverlays();
  };

  const pickTool = (id: ToolId) => {
    if (id === 'embed') {
      void placeWebEmbed();
      return;
    }
    setTool(id);
    closeOverlays();
  };

  const onCategoryClick = (cat: ToolCategory) => {
    if (cat.tool === 'embed') {
      void placeWebEmbed();
      return;
    }
    if (cat.tool && !cat.items?.length && !cat.flyout && !cat.panel) {
      pickTool(cat.tool);
      return;
    }
    setColorOpen(false);
    setMoreShapes(false);
    setMoreToolsOpen(false);
    setOpenCat((cur) => (cur === cat.id ? null : cat.id));
  };

  const duplicateSelected = () => {
    const ids = selectedIds.length ? selectedIds : selectedId ? [selectedId] : [];
    for (const id of ids) {
      const src = conn.getObject(id);
      if (!src) continue;
      const copy = {
        ...src,
        id: nanoid(OBJECT_ID_LENGTH),
        x: src.x + 24,
        y: src.y + 24,
        z: conn.nextZ(),
        impulse: null,
        votes: [],
        createdBy: conn.identity.id,
      };
      conn.addObject(copy);
      setSelectedId(copy.id);
    }
  };

  return (
    <>
      <div
        className={`toolbar-shell${openCat || colorOpen || moreToolsOpen ? ' toolbar-shell-flyout-open' : ''}`}
        ref={rootRef}
      >
        <div
          className={`toolbar panel${recorder.recording ? ' is-recording' : ''}`}
          data-tour="toolbar"
          role="toolbar"
          aria-label="Canvas tools"
        >
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const active = categoryOwnsTool(cat, tool);
            const expanded = openCat === cat.id;
            const popup = hasPopup(cat);
            const button = (
              <Tooltip label={cat.label} side="right">
                <button
                  type="button"
                  className={`tool-btn ${active ? 'active' : ''} ${expanded ? 'expanded' : ''}`}
                  data-tour={
                    cat.id === 'sticky' ||
                    cat.id === 'physics' ||
                    cat.id === 'connect' ||
                    cat.id === 'frame' ||
                    cat.id === 'stickers' ||
                    cat.id === 'code'
                      ? cat.id
                      : undefined
                  }
                  data-orbit-tool={cat.id}
                  aria-label={cat.label}
                  aria-haspopup={popup ? 'menu' : undefined}
                  aria-expanded={popup ? expanded : undefined}
                  aria-pressed={active}
                  onClick={() => onCategoryClick(cat)}
                >
                  <Icon size={18} strokeWidth={2} aria-hidden />
                </button>
              </Tooltip>
            );
            if (!popup) return <div key={cat.id}>{button}</div>;
            return (
              <div key={cat.id} className="toolbar-anchor">
                {button}
                {expanded && (
                  <div className="tool-flyout-stack toolbar-anchor-flyout" ref={flyoutRef}>
                    {cat.panel === 'stickers' && (
                      <StickersFlyout
                        onClose={() => {
                          setOpenCat(null);
                        }}
                      />
                    )}
                    {cat.connectors && (
                      <div className="tool-flyout panel" role="menu" aria-label={cat.label}>
                        <div className="tool-flyout-title">{cat.label}</div>
                        {CONNECTOR_STYLE_ITEMS.map((item) => {
                          const ItemIcon = item.icon;
                          const active = tool === 'connector' && connectorStyle === item.style;
                          return (
                            <button
                              key={item.style}
                              type="button"
                              role="menuitem"
                              className={`tool-flyout-item ${active ? 'active' : ''}`}
                              data-orbit-tool={`connector-${item.style}`}
                              onClick={() => pickConnectorStyle(item.style)}
                            >
                              <ItemIcon size={16} strokeWidth={2} aria-hidden />
                              <span>{item.label}</span>
                              {item.key && <kbd>{item.key}</kbd>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {cat.items && (
                      <div className="tool-flyout panel" role="menu" aria-label={cat.label}>
                        <div className="tool-flyout-title">{cat.label}</div>
                        {cat.items.map((item) => {
                          const ItemIcon = item.icon;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              role="menuitem"
                              className={`tool-flyout-item ${tool === item.id ? 'active' : ''}`}
                              data-orbit-tool={item.id}
                              onClick={() => pickTool(item.id)}
                            >
                              <ItemIcon size={16} strokeWidth={2} aria-hidden />
                              <span>{item.label}</span>
                              {item.key && <kbd>{item.key}</kbd>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {cat.flyout && (
                      <div className="tool-flyout panel" role="menu" aria-label={cat.label}>
                        <div className="tool-flyout-title">{cat.label}</div>
                        {cat.flyout.map((row, idx) => {
                          if (row.kind === 'sep') {
                            return <div key={`sep-${idx}`} className="tool-flyout-sep" role="separator" />;
                          }
                          if (row.kind === 'more') {
                            return (
                              <button
                                key="more"
                                type="button"
                                role="menuitem"
                                className={`tool-flyout-item tool-flyout-more ${moreShapes ? 'active' : ''}`}
                                data-orbit-tool="shapesMore"
                                onClick={() => setMoreShapes((v) => !v)}
                              >
                                <span>More shapes</span>
                                <ChevronRight size={16} strokeWidth={2} aria-hidden />
                              </button>
                            );
                          }
                          if (row.kind === 'diagram') {
                            return (
                              <button
                                key="diagram"
                                type="button"
                                role="menuitem"
                                className="tool-flyout-item tool-flyout-diagram"
                                onClick={() => {
                                  setOpenCat(null);
                                  setMoreShapes(false);
                                  const center = viewportCenter();
                                  const { width, height } = DEFAULTS.diagram;
                                  const id = nanoid(OBJECT_ID_LENGTH);
                                  conn.addObject({
                                    id,
                                    type: 'frame',
                                    role: 'diagram',
                                    diagramEmpty: true,
                                    text: 'Diagram',
                                    x: center.x - width / 2,
                                    y: center.y - height / 2,
                                    width,
                                    height,
                                    rotation: 0,
                                    fill: '#ffffff',
                                    stroke: '#c5cad3',
                                    strokeWidth: 1.5,
                                    textColor: '#1c1c1e',
                                    z: conn.nextZ(),
                                    createdBy: conn.identity.id,
                                  });
                                  setSelectedId(id);
                                  setTool('select');
                                }}
                              >
                                <Orbit size={16} strokeWidth={2} aria-hidden />
                                <span>Diagram</span>
                              </button>
                            );
                          }
                          const item = row.item;
                          const ItemIcon = item.icon;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              role="menuitem"
                              className={`tool-flyout-item ${tool === item.id ? 'active' : ''}`}
                              data-orbit-tool={item.id}
                              onClick={() => pickTool(item.id)}
                            >
                              <ItemIcon size={16} strokeWidth={2} aria-hidden />
                              <span>{item.label}</span>
                              {item.key && <kbd>{item.key}</kbd>}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {moreShapes && cat.flyout && (
                      <MoreShapesPanel
                        conn={conn}
                        onClose={() => setMoreShapes(false)}
                        onPickTool={pickTool}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div className="toolbar-divider" />

          <div className="toolbar-media-rail" data-tour="media">
            <Tooltip label="Add image" side="right">
              <button
                type="button"
                className="tool-btn"
                aria-label="Add image"
                data-orbit-tool="image"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImagePlus size={18} strokeWidth={2} aria-hidden />
              </button>
            </Tooltip>

            <div className={`toolbar-mic-wrap${recorder.recording ? ' recording' : ''}`}>
              <Tooltip label={recorder.recording ? 'Stop recording' : 'Voice note'} side="right">
                <button
                  type="button"
                  className={`tool-btn${recorder.recording ? ' active' : ''}`}
                  aria-label={recorder.recording ? 'Stop recording' : 'Record voice note'}
                  aria-pressed={recorder.recording}
                  data-orbit-tool="voice"
                  onClick={() => {
                    setOpenCat(null);
                    setMoreShapes(false);
                    setMoreToolsOpen(false);
                    setColorOpen(false);
                    if (recorder.recording) recorder.stop();
                    else
                      void recorder.start().catch(() =>
                        dialogAlert('Microphone access is needed to record a voice note.'),
                      );
                  }}
                >
                  <Mic size={18} strokeWidth={2} aria-hidden />
                </button>
              </Tooltip>
              {recorder.recording && (
                <VoiceRecordStrip
                  className="voice-record-beside-mic"
                  seconds={recorder.seconds}
                  levels={recorder.levels}
                  onStop={() => recorder.stop()}
                />
              )}
            </div>
          </div>

          <div className="toolbar-divider" />

          <div className="toolbar-anchor">
            <Tooltip label="More tools" side="right">
              <button
                type="button"
                className={`tool-btn ${moreToolsOpen || openCat === 'charts' || openCat === 'resources' ? 'expanded' : ''} ${moreOwnsTool(tool) ? 'active' : ''}`}
                aria-label="More tools"
                data-tour="moreTools"
                data-orbit-tool="moreTools"
                aria-haspopup="menu"
                aria-expanded={moreToolsOpen}
                onClick={() => {
                  setOpenCat(null);
                  setMoreShapes(false);
                  setColorOpen(false);
                  setMoreToolsOpen((v) => !v);
                }}
              >
                <Ellipsis size={18} strokeWidth={2} aria-hidden />
              </button>
            </Tooltip>
            {moreToolsOpen && (
              <div
                className="tool-flyout panel toolbar-anchor-flyout toolbar-more-flyout"
                role="menu"
                aria-label="More tools"
                ref={flyoutRef}
              >
                <div className="tool-flyout-title">More tools</div>
                <div className="tool-flyout-subtitle">Create</div>
                {MORE_CREATE_TOOLS.map((item) => {
                  const ItemIcon = item.icon;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      role="menuitem"
                      className={`tool-flyout-item ${tool === item.id ? 'active' : ''}`}
                      data-orbit-tool={item.id}
                      onClick={() => pickTool(item.id)}
                    >
                      <ItemIcon size={16} strokeWidth={2} aria-hidden />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  role="menuitem"
                  className="tool-flyout-item"
                  data-orbit-tool="charts"
                  onClick={() => {
                    setMoreToolsOpen(false);
                    setOpenCat('charts');
                  }}
                >
                  <BarChart3 size={16} strokeWidth={2} aria-hidden />
                  <span>Charts</span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="tool-flyout-item"
                  data-orbit-tool="resources"
                  onClick={() => {
                    setMoreToolsOpen(false);
                    setOpenCat('resources');
                  }}
                >
                  <FolderOpen size={16} strokeWidth={2} aria-hidden />
                  <span>Other resources</span>
                </button>
              </div>
            )}
            {openCat === 'charts' && (
              <div className="tool-flyout-stack toolbar-anchor-flyout" ref={flyoutRef}>
                <ChartsPanel conn={conn} onClose={() => setOpenCat(null)} />
              </div>
            )}
            {openCat === 'resources' && (
              <div className="tool-flyout-stack toolbar-anchor-flyout" ref={flyoutRef}>
                <ResourcesPanel
                  conn={conn}
                  onClose={() => setOpenCat(null)}
                  onRequestAudio={() => {
                    void recorder.start().catch(() =>
                      dialogAlert('Microphone access is needed to record a voice note.'),
                    );
                  }}
                />
              </div>
            )}
          </div>

          <div className="toolbar-divider" />

          <div className="toolbar-anchor toolbar-colors-anchor" data-tour="colors">
            <Tooltip label="Colors" side="right">
              <button
                type="button"
                className={`tool-btn toolbar-color-trigger ${colorOpen ? 'expanded' : ''}`}
                aria-label="Colors"
                data-orbit-tool="colors"
                aria-haspopup="dialog"
                aria-expanded={colorOpen}
                onClick={() => {
                  setOpenCat(null);
                  setMoreShapes(false);
                  setMoreToolsOpen(false);
                  setColorOpen((v) => !v);
                }}
              >
                <span
                  className={`toolbar-color-chip ${isNoFill(fillColor) ? 'color-swatch-nofill' : ''}`}
                  style={isNoFill(fillColor) ? undefined : { background: fillColor }}
                  aria-hidden
                />
              </button>
            </Tooltip>
            {colorOpen && (
              <div
                className="color-flyout panel toolbar-anchor-flyout"
                role="dialog"
                aria-label="Color picker"
                ref={flyoutRef}
              >
                <div className="tool-flyout-title">Color picker</div>
                <div className="toolbar-colors toolbar-colors-in-flyout" role="group" aria-label="Fill colors">
                  <button
                    type="button"
                    className={`color-swatch-btn color-swatch-nofill ${isNoFill(fillColor) ? 'active' : ''}`}
                    aria-label="No fill"
                    aria-pressed={isNoFill(fillColor)}
                    onClick={() => pickFill(NO_FILL)}
                  />
                  {OBJECT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`color-swatch-btn ${!isNoFill(fillColor) && fillColor.toLowerCase() === c.toLowerCase() ? 'active' : ''}`}
                      style={{ background: c }}
                      aria-label={`Color ${c}`}
                      aria-pressed={!isNoFill(fillColor) && fillColor.toLowerCase() === c.toLowerCase()}
                      onClick={() => pickFill(c)}
                    />
                  ))}
                </div>
                <div className="palette-grid">
                  {PALETTE_SWATCHES.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`palette-swatch ${fillColor.toLowerCase() === c.toLowerCase() ? 'active' : ''}`}
                      style={{ background: c }}
                      aria-label={`Color ${c}`}
                      onClick={() => pickFill(c, true)}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="btn color-picker-btn"
                  onClick={() => colorInputRef.current?.click()}
                >
                  <Pipette size={16} strokeWidth={2} aria-hidden />
                  Custom color…
                </button>
                <div
                  className="color-current"
                  style={{ borderColor: isNoFill(fillColor) ? 'var(--panel-border)' : fillColor }}
                >
                  <span
                    className={`color-current-swatch ${isNoFill(fillColor) ? 'color-swatch-nofill' : ''}`}
                    style={isNoFill(fillColor) ? undefined : { background: fillColor }}
                  />
                  <code>{isNoFill(fillColor) ? 'No fill' : fillColor}</code>
                </div>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              void handleImageFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <input
            ref={colorInputRef}
            type="color"
            className="color-native"
            value={normalizeHex(fillColor)}
            onChange={(e) => pickFill(e.target.value)}
            aria-label="Custom color picker"
            tabIndex={-1}
          />
        </div>
      </div>

      {/* Own dock so mobile chrome never clips or buries the Gravity control. */}
      <div
        ref={gravityDockRef}
        className={`gravity-dock${gravityTucked ? ' gravity-dock-tucked' : ''}`}
      >
        <Tooltip
          label={
            boardGravity
              ? 'Gravity is on. Loose objects fall and stack. Same for everyone in the room.'
              : 'Turn on gravity so loose objects fall and stack. Same for everyone in the room.'
          }
          side="top"
        >
          <button
            type="button"
            className={`gravity-toggle ${boardGravity ? 'on' : ''}`}
            data-tour="gravity"
            data-orbit-tool="gravity"
            aria-label={APP_NAME}
            aria-pressed={boardGravity}
            onClick={() => toggleBoardGravity(conn)}
          >
            <Orbit size={16} strokeWidth={2.25} aria-hidden />
            <span className="gravity-toggle-label">Gravity</span>
            <span className="gravity-toggle-switch" aria-hidden>
              <span className="gravity-toggle-knob" />
            </span>
          </button>
        </Tooltip>
      </div>

      {(selected || multi) && (
        <div className="selection-bar panel has-selection">
          <div className="selection-actions">
            {selected && !multi && (
              <Tooltip
                label={
                  selected.physics
                    ? 'Physics on for this shape. Flick to throw, or turn Gravity on to fall'
                    : 'Physics off. Click to enable for this shape only'
                }
                side="top"
              >
                <button
                  type="button"
                  className={`btn selection-chip ${selected.physics ? 'btn-accent' : ''}`}
                  onClick={() => conn.updateObject(selected.id, { physics: !selected.physics, impulse: null })}
                >
                  <Wand2 size={14} aria-hidden />
                  {selected.physics ? 'Physics' : 'Static'}
                </button>
              </Tooltip>
            )}
            {multi && (
              <Tooltip label="Turn Physics on for every selected shape" side="top">
                <button
                  type="button"
                  className="btn selection-chip"
                  onClick={() => {
                    for (const id of selectedIds) {
                      conn.updateObject(id, { physics: true, impulse: null });
                    }
                  }}
                >
                  <Wand2 size={14} aria-hidden />
                  Physics all
                </button>
              </Tooltip>
            )}
            <Tooltip label="Duplicate" side="top">
              <button type="button" className="btn selection-chip" onClick={duplicateSelected}>
                Duplicate
              </button>
            </Tooltip>
            {selected && !multi && (
              <VoteMenu
                conn={conn}
                objectId={selected.id}
                votes={selected.votes}
                identity={conn.identity}
                locked={!!selected.locked}
                variant="chip"
                onChange={(votes) => conn.updateObject(selected.id, { votes })}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function hasPopup(cat: ToolCategory): boolean {
  return !!(cat.items?.length || cat.flyout || cat.panel || cat.connectors);
}
