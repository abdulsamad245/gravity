import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  AppWindow,
  Bold,
  ChevronsDownUp,
  ChevronsUpDown,
  Code2,
  Copy,
  Droplets,
  EllipsisVertical,
  Eye,
  Highlighter,
  IndentDecrease,
  IndentIncrease,
  Italic,
  LayoutGrid,
  Link2,
  List,
  ListOrdered,
  ListTree,
  Lock,
  MessageCircle,
  Minus,
  Plus,
  RotateCcw,
  Route,
  Strikethrough,
  Target,
  Trash2,
  Type,
  Underline,
  Unlock,
  Wand2,
} from 'lucide-react';
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { dialogPrompt } from '../../shared/components/DialogHost';
import { OrbitIcon } from '../../shared/components/OrbitIcon';
import { SelectMenu } from '../../shared/components/SelectMenu';
import { Tooltip } from '../../shared/components/Tooltip';
import { ASSISTANT_NAME } from '../../shared/constants/app.constants';
import { CODE_LANGUAGES, type CodeLanguage } from '../../shared/constants/code.constants';
import {
  CONNECTOR_STYLES,
  CONNECTOR_STYLE_LABELS,
  DEFAULT_CONNECTOR_STYLE,
  type ConnectorStyle,
} from '../../shared/constants/connector.constants';
import { CHART_DEFINITIONS, type ChartKind } from '../../shared/constants/chart.constants';
import {
  GRAVITY,
  HIGHLIGHT_COLORS,
  isNoFill,
  NO_FILL,
  OBJECT_COLORS,
  PALETTE_SWATCHES,
} from '../../shared/constants/colors.constants';
import { FONT_OPTIONS, fontLabelFor } from '../../shared/constants/fonts.constants';
import type { CanvasObject, Identity, ObjectVote } from '../../shared/types';
import { clamp } from '../../shared/utils/geometry';
import {
  clampIndent,
  colorPatchForObject,
  cycleAlign,
  effectiveAlign,
  effectiveFontFamily,
  effectiveFontSize,
  effectiveIndent,
  effectiveListStyle,
  effectiveOpacity,
  effectiveStrokeWidth,
  effectiveTextColor,
  isBold,
  isItalic,
  isStrike,
  isUnderline,
  strokeWidthPatchForObject,
  supportsFillColor,
  supportsFontSize,
  supportsStrokeWidth,
  supportsTextStyle,
  textColorPatchForObject,
  toggleBoldStyle,
  toggleItalicStyle,
  toggleTextDecoration,
} from '../../shared/utils/object-style';
import { EMBED_URL_PROMPT, validateEmbedUrl } from '../../shared/utils/validate-embed-url';
import { useViewStore } from '../../stores/view.store';
import type { RoomConnection } from '../collaboration/RoomConnection';
import { VoteMenu } from './VoteMenu';

type FlyoutId = 'fill' | 'text' | 'style' | 'list' | 'highlight' | 'more' | null;

interface Props {
  conn: RoomConnection;
  obj: CanvasObject;
  identity: Identity;
  onPatch: (patch: Partial<CanvasObject>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  /** False when another participant owns this object. */
  canDelete?: boolean;
  onToggleLock: () => void;
  onTogglePhysics: () => void;
  onSettle?: () => void;
  onToggleMagnet?: () => void;
  onRestoreArchived?: () => void;
  onOrbit: () => void;
  onEditText: () => void;
  onComment: () => void;
  onCopyLink: () => void;
  onAddMindMapChild?: () => void;
  onLayoutMindMap?: () => void;
  onToggleMindMapCollapse?: () => void;
  onRevealPrivateIdea?: () => void;
}

const FONT_MIN = 10;
const FONT_MAX = 96;
const STROKE_MIN = 0;
const STROKE_MAX = 24;
const CODE_LANGUAGE_OPTIONS = CODE_LANGUAGES.map((language) => ({
  value: language.id,
  label: language.label,
}));

export function SelectionToolbar({
  conn,
  obj,
  identity,
  onPatch,
  onDuplicate,
  onDelete,
  canDelete = true,
  onToggleLock,
  onTogglePhysics,
  onSettle,
  onToggleMagnet,
  onRestoreArchived,
  onOrbit,
  onEditText,
  onComment,
  onCopyLink,
  onAddMindMapChild,
  onLayoutMindMap,
  onToggleMindMapCollapse,
  onRevealPrivateIdea,
}: Props) {
  const view = useViewStore();
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const [flyout, setFlyout] = useState<FlyoutId>(null);
  const chromeRef = useRef<HTMLDivElement>(null);
  const fillInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const highlightInputRef = useRef<HTMLInputElement>(null);

  const closeFlyouts = () => setFlyout(null);
  const toggleFlyout = (id: Exclude<FlyoutId, null>) =>
    setFlyout((cur) => (cur === id ? null : id));

  // Reposition only (never resize). Prefer above the object; flip below if needed.
  useLayoutEffect(() => {
    const place = () => {
      const el = chromeRef.current;
      const w = el?.offsetWidth || 320;
      const h = el?.offsetHeight || 48;
      const half = w / 2;
      const padRight = 12;
      const padLeft = 64; // clear left tool rail
      const topSafe = 72; // below presence bar
      const bottomSafe = 12;
      const gap = 12;

      const cx = (obj.x + obj.width / 2) * view.scale + view.x;
      const objTop = obj.y * view.scale + view.y;
      const objBottom = (obj.y + obj.height) * view.scale + view.y;

      // `top` is the bottom edge of the bar (CSS translateY(-100%))
      let top = objTop - gap;
      if (top - h < topSafe) {
        // Flip below the object — same size, new anchor
        top = objBottom + gap + h;
      }
      top = clamp(top, topSafe + h, window.innerHeight - bottomSafe);

      const minL = padLeft + half;
      const maxL = window.innerWidth - padRight - half;
      const left = maxL >= minL ? clamp(cx, minL, maxL) : window.innerWidth / 2;

      setPos({ left, top });
    };
    place();
    const unsub = useViewStore.subscribe(place);
    window.addEventListener('resize', place);
    return () => {
      unsub();
      window.removeEventListener('resize', place);
    };
  }, [obj.x, obj.y, obj.width, obj.height, view.scale, view.x, view.y, obj.type, flyout]);

  useEffect(() => {
    if (!flyout) return;
    const onDown = (e: MouseEvent) => {
      if (chromeRef.current && !chromeRef.current.contains(e.target as Node)) closeFlyouts();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeFlyouts();
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [flyout]);

  const fontSize = effectiveFontSize(obj);
  const strokeWidth = effectiveStrokeWidth(obj);
  const canFill = supportsFillColor(obj);
  const canText = supportsTextStyle(obj);
  const canFont = supportsFontSize(obj);
  const canStroke = supportsStrokeWidth(obj);
  const canEditText =
    obj.type === 'text' || obj.type === 'sticky' || obj.type === 'frame' || obj.type === 'table' || obj.type === 'code';
  const fillColor =
    obj.type === 'path' || obj.type === 'connector' || obj.type === 'rope'
      ? (obj.stroke ?? obj.fill)
      : obj.fill;
  const textColor = effectiveTextColor(obj);
  const align = effectiveAlign(obj);
  const bold = isBold(obj);
  const italic = isItalic(obj);
  const underline = isUnderline(obj);
  const strike = isStrike(obj);
  const listStyle = effectiveListStyle(obj);
  const indent = effectiveIndent(obj);
  const opacity = effectiveOpacity(obj);
  const locked = !!obj.locked;
  const familyLabel = fontLabelFor(obj.fontFamily);

  const patch = (p: Partial<CanvasObject>) => {
    if (locked) return;
    onPatch(p);
  };
  const setFont = (next: number) => patch({ fontSize: clamp(Math.round(next), FONT_MIN, FONT_MAX) });
  const setStroke = (next: number) => {
    const width = clamp(Math.round(next), STROKE_MIN, STROKE_MAX);
    patch(strokeWidthPatchForObject(obj, width));
  };
  const setFill = (c: string) => {
    const p = colorPatchForObject(obj, c);
    if (Object.keys(p).length) patch(p);
  };
  const setTextColor = (c: string) => {
    const p = textColorPatchForObject(obj, c);
    if (Object.keys(p).length) patch(p);
  };
  const editLink = () => {
    void (async () => {
      const raw = await dialogPrompt(
        'Paste a link for this text (leave empty to remove).',
        obj.href ?? 'https://',
        'Insert link',
        {
          confirmLabel: obj.href ? 'Update' : 'Add link',
          validate: (value) => {
            const trimmed = value.trim();
            if (!trimmed) return null;
            try {
              const u = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
              if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'Use an http(s) link.';
              return null;
            } catch {
              return 'That does not look like a valid link.';
            }
          },
        },
      );
      if (raw == null) return;
      const trimmed = raw.trim();
      if (!trimmed) {
        patch({ href: undefined });
        return;
      }
      try {
        const u = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
        patch({ href: u.href });
      } catch {
        /* validated above */
      }
    })();
  };

  const AlignIcon = align === 'center' ? AlignCenter : align === 'right' ? AlignRight : AlignLeft;
  const textInkTypes =
    obj.type === 'text' || obj.type === 'stamp' || obj.type === 'sticky' || obj.type === 'frame';
  const showShapeSwatches = canFill && !textInkTypes;

  return (
    <div
      ref={chromeRef}
      className="selection-toolbar panel"
      style={{ left: pos.left, top: pos.top }}
      role="toolbar"
      aria-label="Object tools"
    >
      <span className="sel-label" title={obj.type}>
        {obj.type === 'text' ? <Type size={15} strokeWidth={2} /> : null}
        {obj.type === 'code' ? <Code2 size={15} strokeWidth={2} /> : null}
        {obj.type === 'stamp' ? <span className="sel-stamp-glyph">{obj.text || '★'}</span> : null}
        {obj.type !== 'text' && obj.type !== 'code' && obj.type !== 'stamp' ? obj.type : null}
      </span>

      {obj.type === 'connector' && (
        <>
          <div className="sel-sep" />
          <SelectMenu
            className="sel-connector-style"
            value={obj.connectorStyle ?? DEFAULT_CONNECTOR_STYLE}
            disabled={locked}
            ariaLabel="Connector style"
            options={CONNECTOR_STYLES.map((style) => ({
              value: style,
              label: CONNECTOR_STYLE_LABELS[style],
            }))}
            onChange={(style: ConnectorStyle) => patch({ connectorStyle: style })}
          />
        </>
      )}

      {obj.type === 'chart' && (
        <>
          <div className="sel-sep" />
          <SelectMenu
            className="sel-chart-kind"
            value={obj.chartKind ?? 'clusteredColumns'}
            disabled={locked}
            ariaLabel="Chart type"
            options={CHART_DEFINITIONS.map((d) => ({
              value: d.kind,
              label: d.label,
            }))}
            onChange={(chartKind: ChartKind) =>
              patch({ chartKind, text: CHART_DEFINITIONS.find((d) => d.kind === chartKind)?.label })
            }
          />
        </>
      )}

      {obj.type === 'code' && (
        <>
          <div className="sel-sep" />
          <SelectMenu
            className="sel-code-language"
            value={obj.language ?? 'typescript'}
            disabled={locked}
            ariaLabel="Code language"
            options={CODE_LANGUAGE_OPTIONS}
            onChange={(language: CodeLanguage) => patch({ language })}
          />
          <div className="sel-font" role="group" aria-label="Code font size">
            <button
              type="button"
              className="tool-btn"
              aria-label="Decrease code font size"
              disabled={locked}
              onClick={() => setFont(fontSize - 1)}
            >
              <Minus size={14} />
            </button>
            <input
              className="sel-font-input"
              type="number"
              min={FONT_MIN}
              max={FONT_MAX}
              value={fontSize}
              disabled={locked}
              aria-label="Code font size"
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value)) setFont(value);
              }}
            />
            <button
              type="button"
              className="tool-btn"
              aria-label="Increase code font size"
              disabled={locked}
              onClick={() => setFont(fontSize + 1)}
            >
              <Plus size={14} />
            </button>
          </div>
        </>
      )}

      {canFont && (
        <>
          <div className="sel-sep" />
          <div className="sel-font" role="group" aria-label="Font size">
            <Tooltip label={locked ? 'Unlock to edit' : 'Smaller'} side="top">
              <button
                type="button"
                className="tool-btn"
                aria-label="Decrease font size"
                disabled={locked}
                onClick={() => setFont(fontSize - 2)}
              >
                <Minus size={14} strokeWidth={2.2} />
              </button>
            </Tooltip>
            <input
              className="sel-font-input"
              type="number"
              min={FONT_MIN}
              max={FONT_MAX}
              value={fontSize}
              disabled={locked}
              aria-label="Font size"
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) setFont(n);
              }}
            />
            <Tooltip label={locked ? 'Unlock to edit' : 'Larger'} side="top">
              <button
                type="button"
                className="tool-btn"
                aria-label="Increase font size"
                disabled={locked}
                onClick={() => setFont(fontSize + 2)}
              >
                <Plus size={14} strokeWidth={2.2} />
              </button>
            </Tooltip>
          </div>
        </>
      )}

      {canText && (
        <>
          <div className="sel-sep" />
          <div className="sel-format-wrap">
            <Tooltip label={locked ? 'Unlock to edit' : 'Text style'} side="top">
              <button
                type="button"
                className={`tool-btn sel-style-btn ${bold || italic || underline || strike || flyout === 'style' ? 'active' : ''}`}
                aria-label="Text style"
                aria-haspopup="menu"
                aria-expanded={flyout === 'style'}
                disabled={locked}
                onClick={() => toggleFlyout('style')}
              >
                <span className="sel-letter-mark" aria-hidden>
                  B
                </span>
                <span
                  className="sel-color-bar"
                  style={{ background: bold || italic || underline || strike ? 'var(--text)' : 'var(--text-dim)' }}
                />
              </button>
            </Tooltip>
            {flyout === 'style' && (
              <div className="sel-mini-flyout panel" role="menu" aria-label="Text style">
                <button
                  type="button"
                  className={`tool-btn ${bold ? 'active' : ''}`}
                  role="menuitemcheckbox"
                  aria-checked={bold}
                  aria-label="Bold"
                  onClick={() => patch({ fontStyle: toggleBoldStyle(obj.fontStyle) })}
                >
                  <Bold size={16} strokeWidth={2.4} />
                </button>
                <button
                  type="button"
                  className={`tool-btn ${italic ? 'active' : ''}`}
                  role="menuitemcheckbox"
                  aria-checked={italic}
                  aria-label="Italic"
                  onClick={() => patch({ fontStyle: toggleItalicStyle(obj.fontStyle) })}
                >
                  <Italic size={16} strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  className={`tool-btn ${underline ? 'active' : ''}`}
                  role="menuitemcheckbox"
                  aria-checked={underline}
                  aria-label="Underline"
                  onClick={() =>
                    patch({ textDecoration: toggleTextDecoration(obj.textDecoration, 'underline') })
                  }
                >
                  <Underline size={16} strokeWidth={2.2} />
                </button>
                <button
                  type="button"
                  className={`tool-btn ${strike ? 'active' : ''}`}
                  role="menuitemcheckbox"
                  aria-checked={strike}
                  aria-label="Strikethrough"
                  onClick={() =>
                    patch({ textDecoration: toggleTextDecoration(obj.textDecoration, 'line-through') })
                  }
                >
                  <Strikethrough size={16} strokeWidth={2.2} />
                </button>
              </div>
            )}
          </div>

          <Tooltip label={locked ? 'Unlock to edit' : `Align ${align}`} side="top">
            <button
              type="button"
              className="tool-btn"
              aria-label={`Align ${align}`}
              disabled={locked}
              onClick={() => patch({ align: cycleAlign(align) })}
            >
              <AlignIcon size={16} strokeWidth={2} />
            </button>
          </Tooltip>

          <div className="sel-format-wrap">
            <Tooltip label={locked ? 'Unlock to edit' : 'List'} side="top">
              <button
                type="button"
                className={`tool-btn ${listStyle !== 'none' || flyout === 'list' ? 'active' : ''}`}
                aria-label="List"
                aria-haspopup="menu"
                aria-expanded={flyout === 'list'}
                disabled={locked}
                onClick={() => toggleFlyout('list')}
              >
                <List size={16} strokeWidth={2} />
              </button>
            </Tooltip>
            {flyout === 'list' && (
              <div className="sel-list-flyout panel" role="menu" aria-label="List options">
                <div className="sel-list-row">
                  <button
                    type="button"
                    className={`tool-btn ${listStyle === 'bullet' ? 'active' : ''}`}
                    aria-label="Bulleted list"
                    onClick={() =>
                      patch({ listStyle: listStyle === 'bullet' ? 'none' : 'bullet' })
                    }
                  >
                    <List size={16} />
                  </button>
                  <button
                    type="button"
                    className={`tool-btn ${listStyle === 'numbered' ? 'active' : ''}`}
                    aria-label="Numbered list"
                    onClick={() =>
                      patch({ listStyle: listStyle === 'numbered' ? 'none' : 'numbered' })
                    }
                  >
                    <ListOrdered size={16} />
                  </button>
                </div>
                <div className="sel-list-sep" />
                <div className="sel-list-row">
                  <button
                    type="button"
                    className="tool-btn"
                    aria-label="Decrease indent"
                    disabled={indent <= 0}
                    onClick={() => patch({ indent: clampIndent(indent - 1) })}
                  >
                    <IndentDecrease size={16} />
                  </button>
                  <button
                    type="button"
                    className="tool-btn"
                    aria-label="Increase indent"
                    disabled={indent >= 6}
                    onClick={() => patch({ indent: clampIndent(indent + 1) })}
                  >
                    <IndentIncrease size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>

          <Tooltip label={locked ? 'Unlock to edit' : obj.href ? 'Edit link' : 'Insert link'} side="top">
            <button
              type="button"
              className={`tool-btn ${obj.href ? 'active' : ''}`}
              aria-label={obj.href ? 'Edit link' : 'Insert link'}
              disabled={locked}
              onClick={editLink}
            >
              <Link2 size={16} strokeWidth={2} />
            </button>
          </Tooltip>

          <div className="sel-format-wrap">
            <Tooltip label={locked ? 'Unlock to edit' : 'Text color'} side="top">
              <button
                type="button"
                className={`tool-btn sel-color-btn ${flyout === 'text' ? 'active' : ''}`}
                aria-label="Text color"
                aria-haspopup="dialog"
                aria-expanded={flyout === 'text'}
                disabled={locked}
                onClick={() => toggleFlyout('text')}
              >
                <span className="sel-letter-mark" aria-hidden>
                  A
                </span>
                <span className="sel-color-bar" style={{ background: textColor || GRAVITY.ink }} />
              </button>
            </Tooltip>
            {flyout === 'text' && (
              <ColorPickerFlyout
                active={textColor}
                label="Text color"
                onPick={setTextColor}
                inputRef={textInputRef}
              />
            )}
          </div>

          <div className="sel-format-wrap">
            <Tooltip label={locked ? 'Unlock to edit' : 'Highlight'} side="top">
              <button
                type="button"
                className={`tool-btn sel-color-btn ${obj.highlight || flyout === 'highlight' ? 'active' : ''}`}
                aria-label="Highlight"
                aria-haspopup="dialog"
                aria-expanded={flyout === 'highlight'}
                disabled={locked}
                onClick={() => toggleFlyout('highlight')}
              >
                <Highlighter size={15} strokeWidth={2} />
                <span
                  className="sel-color-bar"
                  style={{ background: obj.highlight || HIGHLIGHT_COLORS[0] }}
                />
              </button>
            </Tooltip>
            {flyout === 'highlight' && (
              <div className="sel-color-flyout panel" role="dialog" aria-label="Highlight color">
                <div className="sel-color-grid">
                  <button
                    type="button"
                    className={`sel-swatch lg color-swatch-nofill ${!obj.highlight ? 'active' : ''}`}
                    aria-label="No highlight"
                    onClick={() => patch({ highlight: undefined })}
                  />
                  {HIGHLIGHT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`sel-swatch lg ${obj.highlight?.toLowerCase() === c.toLowerCase() ? 'active' : ''}`}
                      style={{ background: c }}
                      aria-label={`Highlight ${c}`}
                      onClick={() => patch({ highlight: c })}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  className="btn sel-custom-color"
                  onClick={() => highlightInputRef.current?.click()}
                >
                  Custom color
                </button>
                <input
                  ref={highlightInputRef}
                  type="color"
                  className="sr-only"
                  value={/^#[0-9a-fA-F]{6}$/.test(obj.highlight ?? '') ? obj.highlight! : HIGHLIGHT_COLORS[0]}
                  onChange={(e) => patch({ highlight: e.target.value })}
                />
              </div>
            )}
          </div>
        </>
      )}

      {showShapeSwatches && (
        <>
          <div className="sel-sep" />
          <div className="sel-colors" role="group" aria-label="Colors">
            <Tooltip label={locked ? 'Unlock to recolor' : 'No fill'} side="top">
              <button
                type="button"
                className={`sel-swatch color-swatch-nofill ${isNoFill(fillColor ?? '') ? 'active' : ''}`}
                aria-label="No fill"
                aria-haspopup="dialog"
                aria-expanded={flyout === 'fill'}
                disabled={locked}
                onClick={() => {
                  setFill(NO_FILL);
                  toggleFlyout('fill');
                }}
              />
            </Tooltip>
            {OBJECT_COLORS.slice(0, 6).map((c) => {
              const active =
                !isNoFill(fillColor ?? '') && fillColor?.toLowerCase() === c.toLowerCase();
              return (
                <Tooltip key={c} label={locked ? 'Unlock to recolor' : 'Fill color'} side="top">
                  <button
                    type="button"
                    className={`sel-swatch ${active ? 'active' : ''}`}
                    style={{ background: c }}
                    aria-label={`Color ${c}`}
                    aria-haspopup="dialog"
                    aria-expanded={flyout === 'fill'}
                    disabled={locked}
                    onClick={() => {
                      setFill(c);
                      setFlyout('fill');
                    }}
                  />
                </Tooltip>
              );
            })}
            {flyout === 'fill' && (
              <ColorPickerFlyout
                active={fillColor}
                label="Fill"
                onPick={setFill}
                inputRef={fillInputRef}
              />
            )}
          </div>
        </>
      )}

      {canStroke && (
        <>
          <div className="sel-sep" />
          <div className="sel-font" role="group" aria-label="Border width">
            <Tooltip label={locked ? 'Unlock to edit' : 'Thinner border'} side="top">
              <button
                type="button"
                className="tool-btn"
                aria-label="Decrease border width"
                disabled={locked}
                onClick={() => setStroke(strokeWidth - 1)}
              >
                <Minus size={14} strokeWidth={2.2} />
              </button>
            </Tooltip>
            <input
              className="sel-font-input"
              type="number"
              min={STROKE_MIN}
              max={STROKE_MAX}
              value={strokeWidth}
              disabled={locked}
              aria-label="Border width"
              title="Border width"
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) setStroke(n);
              }}
            />
            <Tooltip label={locked ? 'Unlock to edit' : 'Thicker border'} side="top">
              <button
                type="button"
                className="tool-btn"
                aria-label="Increase border width"
                disabled={locked}
                onClick={() => setStroke(strokeWidth + 1)}
              >
                <Plus size={14} strokeWidth={2.2} />
              </button>
            </Tooltip>
          </div>
        </>
      )}

      {!canText && (
        <>
          <div className="sel-sep" />
          <div className="sel-opacity" title={`Opacity ${Math.round(opacity * 100)}%`}>
            <Droplets size={14} strokeWidth={2} aria-hidden />
            <input
              type="range"
              min={15}
              max={100}
              step={5}
              value={Math.round(opacity * 100)}
              disabled={locked}
              aria-label="Opacity"
              onChange={(e) => patch({ opacity: Number(e.target.value) / 100 })}
            />
          </div>
        </>
      )}

      {canEditText && !canText && (
        <>
          <div className="sel-sep" />
          <Tooltip label={locked ? 'Unlock to edit' : obj.type === 'code' ? 'Edit code' : 'Edit text'} side="top">
            <button
              type="button"
              className="tool-btn"
              aria-label={obj.type === 'code' ? 'Edit code' : 'Edit text'}
              disabled={locked}
              onClick={onEditText}
            >
              {obj.type === 'code' ? <Code2 size={16} /> : 'Aa'}
            </button>
          </Tooltip>
        </>
      )}

      <div className="sel-sep" />
      <Tooltip label={obj.physics ? 'Physics on (click to turn off)' : 'Physics off (click to turn on)'} side="top">
        <button
          type="button"
          className={`tool-btn ${obj.physics ? 'active' : ''}`}
          aria-label={obj.physics ? 'Physics on' : 'Physics off'}
          onClick={onTogglePhysics}
        >
          <Wand2 size={16} />
        </button>
      </Tooltip>
      {onSettle && (
        <Tooltip label="Settle into a neat grid" side="top">
          <button type="button" className="tool-btn" aria-label="Settle selection" onClick={onSettle}>
            <LayoutGrid size={16} />
          </button>
        </Tooltip>
      )}
      {onToggleMagnet && (
        <Tooltip label={obj.role === 'magnet' ? 'Remove topic magnet' : 'Make topic magnet'} side="top">
          <button
            type="button"
            className={`tool-btn ${obj.role === 'magnet' ? 'active' : ''}`}
            aria-label={obj.role === 'magnet' ? 'Remove topic magnet' : 'Make topic magnet'}
            onClick={onToggleMagnet}
          >
            <Target size={16} />
          </button>
        </Tooltip>
      )}
      {obj.archived && onRestoreArchived && (
        <Tooltip label="Restore from archive well" side="top">
          <button type="button" className="tool-btn" aria-label="Restore from archive" onClick={onRestoreArchived}>
            <RotateCcw size={16} />
          </button>
        </Tooltip>
      )}
      <Tooltip label="Duplicate" side="top">
        <button type="button" className="tool-btn" aria-label="Duplicate" onClick={onDuplicate}>
          <Copy size={16} />
        </button>
      </Tooltip>
      <Tooltip label={obj.locked ? 'Unlock' : 'Lock'} side="top">
        <button
          type="button"
          className="tool-btn"
          aria-label={obj.locked ? 'Unlock' : 'Lock'}
          onClick={onToggleLock}
        >
          {obj.locked ? <Unlock size={16} /> : <Lock size={16} />}
        </button>
      </Tooltip>
      <Tooltip label={`Ask ${ASSISTANT_NAME}`} side="top">
        <button type="button" className="tool-btn" aria-label={`Ask ${ASSISTANT_NAME}`} onClick={onOrbit}>
          <OrbitIcon size={16} />
        </button>
      </Tooltip>
      {!canText && (
        <>
          <Tooltip label="Add comment" side="top">
            <button type="button" className="tool-btn" aria-label="Add comment" onClick={onComment}>
              <MessageCircle size={16} />
            </button>
          </Tooltip>
          <Tooltip label="Copy link to object" side="top">
            <button type="button" className="tool-btn" aria-label="Copy link to object" onClick={onCopyLink}>
              <Link2 size={16} />
            </button>
          </Tooltip>
        </>
      )}
      {obj.type === 'embed' && (
        <Tooltip label={locked ? 'Unlock to change URL' : 'Change embed URL'} side="top">
          <button
            type="button"
            className="tool-btn"
            aria-label="Change embed URL"
            disabled={locked}
            onClick={() => {
              void (async () => {
                const raw = await dialogPrompt(
                  EMBED_URL_PROMPT,
                  obj.src ?? '',
                  'Web embed',
                  {
                    confirmLabel: 'Update',
                    validate: (value) => {
                      const checked = validateEmbedUrl(value);
                      return checked.ok ? null : checked.error;
                    },
                  },
                );
                if (raw == null) return;
                const checked = validateEmbedUrl(raw);
                if (!checked.ok) return;
                patch({ src: checked.href });
              })();
            }}
          >
            <AppWindow size={16} />
          </button>
        </Tooltip>
      )}
      <div className="sel-sep" />
      {obj.mindMapId && onAddMindMapChild && onLayoutMindMap && (
        <>
          <Tooltip label="Add child idea" side="top">
            <button type="button" className="tool-btn" aria-label="Add child idea" onClick={onAddMindMapChild}>
              <ListTree size={16} />
            </button>
          </Tooltip>
          <Tooltip label="Auto-layout mind map" side="top">
            <button type="button" className="tool-btn" aria-label="Auto-layout mind map" onClick={onLayoutMindMap}>
              <Route size={16} />
            </button>
          </Tooltip>
          {onToggleMindMapCollapse && (
            <Tooltip label={obj.mindMapCollapsed ? 'Expand branch' : 'Collapse branch'} side="top">
              <button
                type="button"
                className="tool-btn"
                aria-label={obj.mindMapCollapsed ? 'Expand branch' : 'Collapse branch'}
                onClick={onToggleMindMapCollapse}
              >
                {obj.mindMapCollapsed ? <ChevronsUpDown size={16} /> : <ChevronsDownUp size={16} />}
              </button>
            </Tooltip>
          )}
          <div className="sel-sep" />
        </>
      )}
      {onRevealPrivateIdea && (
        <>
          <Tooltip label="Reveal my sticky" side="top">
            <button type="button" className="tool-btn" aria-label="Reveal my sticky" onClick={onRevealPrivateIdea}>
              <Eye size={16} />
            </button>
          </Tooltip>
          <div className="sel-sep" />
        </>
      )}
      <VoteMenu
        conn={conn}
        objectId={obj.id}
        votes={obj.votes}
        identity={identity}
        locked={locked}
        variant="toolbar"
        onChange={(votes: ObjectVote[]) => patch({ votes })}
      />
      {canText && (
        <>
          <div className="sel-sep" />
          <div className="sel-format-wrap">
            <Tooltip label="More" side="top">
              <button
                type="button"
                className={`tool-btn ${flyout === 'more' || flyout === 'fill' ? 'active' : ''}`}
                aria-label="More actions"
                aria-haspopup="menu"
                aria-expanded={flyout === 'more' || flyout === 'fill'}
                onClick={() => toggleFlyout('more')}
              >
                <EllipsisVertical size={16} strokeWidth={2.2} />
              </button>
            </Tooltip>
            {flyout === 'more' && (
              <div className="sel-more-menu panel" role="menu" aria-label="More actions">
                <button
                  type="button"
                  className="sel-more-item"
                  role="menuitem"
                  disabled={locked}
                  onClick={() => {
                    closeFlyouts();
                    onEditText();
                  }}
                >
                  Edit text
                </button>
                <div className="sel-more-font" role="group" aria-label="Font family">
                  <span className="sel-more-label">Font · {familyLabel}</span>
                  <div className="sel-more-font-list">
                    {FONT_OPTIONS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        className={`sel-more-font-option ${effectiveFontFamily(obj) === f.stack ? 'active' : ''}`}
                        style={{ fontFamily: f.stack }}
                        disabled={locked}
                        onClick={() => patch({ fontFamily: f.stack })}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>
                {obj.type === 'sticky' && (
                  <button
                    type="button"
                    className="sel-more-item"
                    role="menuitem"
                    disabled={locked}
                    onClick={() => setFlyout('fill')}
                  >
                    Sticky color…
                  </button>
                )}
                <div className="sel-more-opacity">
                  <span>Opacity</span>
                  <input
                    type="range"
                    min={15}
                    max={100}
                    step={5}
                    value={Math.round(opacity * 100)}
                    disabled={locked}
                    aria-label="Opacity"
                    onChange={(e) => patch({ opacity: Number(e.target.value) / 100 })}
                  />
                </div>
                <div className="sel-list-sep" />
                <button
                  type="button"
                  className="sel-more-item"
                  role="menuitem"
                  onClick={() => {
                    closeFlyouts();
                    onComment();
                  }}
                >
                  Add comment
                </button>
                <button
                  type="button"
                  className="sel-more-item"
                  role="menuitem"
                  onClick={() => {
                    closeFlyouts();
                    onCopyLink();
                  }}
                >
                  Copy link to object
                </button>
                {obj.href && (
                  <button
                    type="button"
                    className="sel-more-item"
                    role="menuitem"
                    onClick={() => {
                      window.open(obj.href, '_blank', 'noopener,noreferrer');
                      closeFlyouts();
                    }}
                  >
                    Open link
                  </button>
                )}
              </div>
            )}
            {flyout === 'fill' && obj.type === 'sticky' && (
              <ColorPickerFlyout
                active={fillColor}
                label="Sticky color"
                onPick={setFill}
                inputRef={fillInputRef}
              />
            )}
          </div>
        </>
      )}
      <Tooltip
        label={
          !canDelete
            ? 'You cannot delete this'
            : obj.locked
              ? 'Unlock to delete'
              : 'Delete'
        }
        side="top"
      >
        <button
          type="button"
          className="tool-btn"
          aria-label="Delete"
          disabled={!!obj.locked || !canDelete}
          onClick={onDelete}
        >
          <Trash2 size={16} />
        </button>
      </Tooltip>
    </div>
  );
}

function ColorPickerFlyout({
  active,
  label,
  onPick,
  inputRef,
}: {
  active: string;
  label: string;
  onPick: (c: string) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  return (
    <div className="sel-color-flyout panel" role="dialog" aria-label={label}>
      <div className="sel-color-grid">
        {PALETTE_SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            className={`sel-swatch lg ${active?.toLowerCase() === c.toLowerCase() ? 'active' : ''}`}
            style={{ background: c }}
            aria-label={`Color ${c}`}
            onClick={() => onPick(c)}
          />
        ))}
      </div>
      <button type="button" className="btn sel-custom-color" onClick={() => inputRef.current?.click()}>
        Custom color
      </button>
      <input
        ref={inputRef}
        type="color"
        className="sr-only"
        value={/^#[0-9a-fA-F]{6}$/.test(active) ? active : GRAVITY.flare}
        onChange={(e) => onPick(e.target.value)}
      />
    </div>
  );
}
