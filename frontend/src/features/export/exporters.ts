import Konva from 'konva';
import { APP_NAME } from '../../shared/constants/app.constants';
import { DEFAULT_FONT_SIZE } from '../../shared/constants/canvas.constants';
import { GRAVITY } from '../../shared/constants/colors.constants';
import { CODE_FONT_FAMILY, CODE_FONT_SIZE, CODE_TEXT, codeLanguageLabel } from '../../shared/constants/code.constants';
import { EMOJI_FONT_STACK } from '../../shared/constants/fonts.constants';
import { canvasThemeColors, useThemeStore } from '../../stores/theme.store';
import { useUiStore } from '../../stores/ui.store';
import type { CanvasObject } from '../../shared/types';
import { downloadDataUrl, downloadText } from '../../shared/utils/download';
import { worldBounds } from '../../shared/utils/geometry';
import type { ExportedDocument } from '../../shared/validation/canvas-object.schema';

const EXPORT_MARGIN = 60;
const PNG_MAX_EDGE = 4096;

/** JSON export: the canonical schema, round-trippable via the import validator. */
export function exportJSON(objects: CanvasObject[]): void {
  const doc: ExportedDocument = {
    app: APP_NAME,
    version: 1,
    exportedAt: new Date().toISOString(),
    objects: [...objects].sort((a, b) => a.z - b.z),
  };
  downloadText(JSON.stringify(doc, null, 2), fileName('json'), 'application/json');
}

/**
 * PNG export: temporarily reframes the live stage to fit all content,
 * hides UI-only layers (grid, cursors, transformer), snapshots at 2x,
 * then restores everything.
 */
export function exportPNG(stage: Konva.Stage, objects: CanvasObject[]): void {
  const b = worldBounds(objects);
  if (!b) return;
  const { bg: CANVAS_BG } = canvasThemeColors(
    useThemeStore.getState().resolved,
    useUiStore.getState().canvasBg,
  );

  const w = b.maxX - b.minX + EXPORT_MARGIN * 2;
  const h = b.maxY - b.minY + EXPORT_MARGIN * 2;
  const scale = Math.min(1, PNG_MAX_EDGE / w, PNG_MAX_EDGE / h);

  const prev = {
    x: stage.x(),
    y: stage.y(),
    scale: stage.scaleX(),
    width: stage.width(),
    height: stage.height(),
  };
  const uiLayers = [stage.findOne('.grid'), stage.findOne('.overlay')];
  uiLayers.forEach((l) => l?.visible(false));

  // Solid background behind the content (the stage itself is transparent).
  const bgLayer = new Konva.Layer({ listening: false });
  bgLayer.add(
    new Konva.Rect({
      x: b.minX - EXPORT_MARGIN,
      y: b.minY - EXPORT_MARGIN,
      width: w,
      height: h,
      fill: CANVAS_BG,
    }),
  );
  stage.add(bgLayer);
  bgLayer.moveToBottom();

  stage.size({ width: Math.round(w * scale), height: Math.round(h * scale) });
  stage.scale({ x: scale, y: scale });
  stage.position({ x: -(b.minX - EXPORT_MARGIN) * scale, y: -(b.minY - EXPORT_MARGIN) * scale });
  stage.batchDraw();

  const url = stage.toDataURL({ pixelRatio: 2 });

  bgLayer.destroy();
  stage.size({ width: prev.width, height: prev.height });
  stage.scale({ x: prev.scale, y: prev.scale });
  stage.position({ x: prev.x, y: prev.y });
  uiLayers.forEach((l) => l?.visible(true));
  stage.batchDraw();

  downloadDataUrl(url, fileName('png'));
}

/** SVG export: every object type maps to an SVG primitive; media embeds as data URLs. */
export function exportSVG(objects: CanvasObject[]): void {
  const b = worldBounds(objects);
  if (!b) return;
  const { bg: CANVAS_BG } = canvasThemeColors(
    useThemeStore.getState().resolved,
    useUiStore.getState().canvasBg,
  );

  const minX = b.minX - EXPORT_MARGIN;
  const minY = b.minY - EXPORT_MARGIN;
  const w = b.maxX - b.minX + EXPORT_MARGIN * 2;
  const h = b.maxY - b.minY + EXPORT_MARGIN * 2;

  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${w} ${h}" width="${w}" height="${h}">`,
    `<rect x="${minX}" y="${minY}" width="${w}" height="${h}" fill="${CANVAS_BG}"/>`,
  ];

  for (const o of [...objects].sort((a, c) => a.z - c.z)) {
    parts.push(objectToSvg(o));
  }
  parts.push('</svg>');
  downloadText(parts.join('\n'), fileName('svg'), 'image/svg+xml');
}

function objectToSvg(o: CanvasObject): string {
  const cx = o.x + o.width / 2;
  const cy = o.y + o.height / 2;
  const rot = o.rotation ? ` transform="rotate(${o.rotation} ${cx} ${cy})"` : '';

  switch (o.type) {
    case 'rect':
      return `<rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" rx="10" fill="${o.fill}"${rot}/>`;
    case 'ellipse':
      return `<ellipse cx="${cx}" cy="${cy}" rx="${o.width / 2}" ry="${o.height / 2}" fill="${o.fill}"${rot}/>`;
    case 'triangle':
    case 'diamond':
    case 'star':
    case 'hexagon':
    case 'blockArrow':
      return `<rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" rx="8" fill="${o.fill}" stroke="${o.stroke ?? 'none'}"${rot}/>`;
    case 'line':
    case 'divider':
      return `<line x1="${o.x}" y1="${cy}" x2="${o.x + o.width}" y2="${cy}" stroke="${o.stroke ?? o.fill}" stroke-width="${o.strokeWidth ?? 3}" stroke-linecap="round"${rot}/>`;
    case 'arrow':
    case 'elbowArrow':
      return `<polyline points="${o.x},${cy} ${o.x + o.width},${cy}" fill="none" stroke="${o.stroke ?? o.fill}" stroke-width="${o.strokeWidth ?? 3}" marker-end="url(#arrow)"${rot}/>`;
    case 'sticky':
      return (
        `<g${rot}><rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" rx="6" fill="${o.fill}"/>` +
        svgText(o.text ?? '', o.x + 14, o.y + 14, o.fontSize ?? 18, '#2b2b2b', o.width - 28) +
        '</g>'
      );
    case 'text':
      return `<g${rot}>${svgText(o.text ?? '', o.x, o.y, o.fontSize ?? DEFAULT_FONT_SIZE, o.fill, o.width)}</g>`;
    case 'code':
      return svgCode(o, rot);
    case 'path': {
      const pts = o.points ?? [];
      const abs: string[] = [];
      for (let i = 0; i < pts.length; i += 2) abs.push(`${o.x + pts[i]},${o.y + pts[i + 1]}`);
      return `<polyline points="${abs.join(' ')}" fill="none" stroke="${o.stroke ?? o.fill}" stroke-width="${o.strokeWidth ?? 4}" stroke-linecap="round" stroke-linejoin="round"${rot}/>`;
    }
    case 'image':
      return `<image x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" href="${o.src ?? ''}"${rot}/>`;
    case 'embed':
      return (
        `<g${rot}><rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" rx="10" fill="#1c1f28" stroke="#5b6478" stroke-width="1.5"/>` +
        svgText(o.src ?? 'Web embed', o.x + 12, o.y + 12, 12, '#c8ccd6', o.width - 24) +
        '</g>'
      );
    case 'audio':
      return (
        `<g${rot}><rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" rx="${o.height / 2}" fill="${o.fill}"/>` +
        svgText(`${Math.round(o.audioDuration ?? 0)}s`, o.x + o.height, o.y + o.height / 2 - 6, 11, '#333', o.width - o.height) +
        '</g>'
      );
    case 'video':
      return (
        `<g${rot}><rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" rx="12" fill="${GRAVITY.ink}" stroke="#3d4454"/>` +
        svgText(o.fileName || o.text || 'Video', o.x + 12, o.y + 12, 12, '#e8eaed', o.width - 24) +
        '</g>'
      );
    case 'file':
      return (
        `<g${rot}><rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" rx="12" fill="#1c1f28" stroke="#5b6478"/>` +
        svgText(o.fileName || o.text || 'File', o.x + 12, o.y + o.height / 2 - 6, 12, '#e8eaed', o.width - 24) +
        '</g>'
      );
    case 'chart':
      return (
        `<g${rot}><rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" rx="12" fill="${o.fill || '#16181f'}" stroke="${o.stroke ?? '#3d4454'}"/>` +
        svgText(o.text || 'Chart', o.x + 12, o.y + 10, 12, o.textColor ?? '#e8eaed', o.width - 24) +
        '</g>'
      );
    case 'frame':
      return (
        `<g${rot}><rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" rx="8" fill="${o.fill}" stroke="${o.stroke ?? '#4262ff'}" stroke-width="${o.strokeWidth ?? 2}"/>` +
        svgText(o.text ?? 'Frame', o.x + 10, o.y + 8, 16, o.stroke ?? '#4262ff', o.width - 20) +
        '</g>'
      );
    case 'table':
      return `<rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" rx="6" fill="${o.fill}" stroke="${o.stroke ?? '#4262ff'}" stroke-width="1"${rot}/>`;
    case 'stamp':
      return `<g${rot}>${svgEmoji(o.text ?? '⭐', o.x, o.y, Math.min(o.width, o.height) * 0.7, o.width)}</g>`;
    case 'connector':
    case 'rope':
      return '';
    default:
      return '';
  }
}

function svgText(text: string, x: number, y: number, fontSize: number, fill: string, _maxWidth: number): string {
  const lines = text.split('\n');
  const spans = lines
    .map((line, i) => `<tspan x="${x}" dy="${i === 0 ? fontSize : fontSize * 1.25}">${escapeXml(line)}</tspan>`)
    .join('');
  return `<text x="${x}" y="${y}" font-family="DM Sans, system-ui, sans-serif" font-size="${fontSize}" fill="${fill}">${spans}</text>`;
}

function svgCode(o: CanvasObject, rot: string): string {
  const header = 34;
  const fontSize = o.fontSize ?? CODE_FONT_SIZE;
  const lineHeight = fontSize * 1.55;
  const maxLines = Math.max(1, Math.floor((o.height - header - 20) / lineHeight));
  const lines = (o.text ?? '').split('\n').slice(0, maxLines);
  const content = lines
    .map(
      (line, index) =>
        `<text x="${o.x + 12}" y="${o.y + header + 18 + index * lineHeight}" font-family="ui-monospace, Consolas, monospace" font-size="${fontSize}" fill="#6e7681">${index + 1}</text>` +
        `<text x="${o.x + 52}" y="${o.y + header + 18 + index * lineHeight}" font-family="${CODE_FONT_FAMILY}" font-size="${fontSize}" fill="${o.textColor ?? CODE_TEXT}">${escapeXml(line)}</text>`,
    )
    .join('');
  return (
    `<g${rot}><rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" rx="10" fill="${o.fill}" stroke="${o.stroke ?? '#30363d'}"/>` +
    `<rect x="${o.x}" y="${o.y}" width="${o.width}" height="${header}" rx="10" fill="rgba(255,255,255,0.045)"/>` +
    `<text x="${o.x + o.width - 12}" y="${o.y + 22}" text-anchor="end" font-family="DM Sans, sans-serif" font-size="11" fill="#8b949e">${escapeXml(codeLanguageLabel(o.language))}</text>` +
    content +
    '</g>'
  );
}

function svgEmoji(text: string, x: number, y: number, fontSize: number, maxWidth: number): string {
  return `<text x="${x}" y="${y + fontSize}" text-anchor="start" font-family='${EMOJI_FONT_STACK}' font-size="${fontSize}" width="${maxWidth}">${escapeXml(text)}</text>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fileName(ext: string): string {
  return `${APP_NAME.toLowerCase()}-board-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${ext}`;
}
