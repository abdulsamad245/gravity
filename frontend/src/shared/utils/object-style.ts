import {
  DEFAULT_OUTLINE,
  DEFAULT_SHAPE_STROKE_WIDTH,
  GRAVITY,
  isNoFill,
} from '../constants/colors.constants';
import { DEFAULT_FONT_SIZE } from '../constants/canvas.constants';
import { CODE_TEXT } from '../constants/code.constants';
import { DEFAULT_FONT_STACK, fontStackFor, type TextAlign } from '../constants/fonts.constants';
import type { CanvasObject } from '../types';

const STROKE_WIDTH_TYPES = new Set<CanvasObject['type']>([
  'rect',
  'ellipse',
  'triangle',
  'diamond',
  'star',
  'hexagon',
  'frame',
  'line',
  'arrow',
  'elbowArrow',
  'blockArrow',
  'divider',
  'path',
  'connector',
  'rope',
]);

/** Patch to apply a color to an object (fill and/or stroke by type). */
export function colorPatchForObject(obj: CanvasObject, color: string): Partial<CanvasObject> {
  if (obj.type === 'image' || obj.type === 'audio') return {};
  const ink = isNoFill(color) ? DEFAULT_OUTLINE : color;
  if (
    obj.type === 'path' ||
    obj.type === 'connector' ||
    obj.type === 'rope' ||
    obj.type === 'line' ||
    obj.type === 'arrow' ||
    obj.type === 'elbowArrow' ||
    obj.type === 'divider'
  ) {
    return { stroke: ink, fill: ink };
  }
  if (obj.type === 'blockArrow') {
    return { fill: ink, stroke: ink };
  }
  if (obj.type === 'sticky') {
    if (isNoFill(color)) return {};
    return { fill: color };
  }
  if (isNoFill(color)) {
    return {
      fill: 'transparent',
      stroke: obj.stroke && !isNoFill(obj.stroke) ? obj.stroke : DEFAULT_OUTLINE,
      strokeWidth: obj.strokeWidth ?? DEFAULT_SHAPE_STROKE_WIDTH,
    };
  }
  return { fill: color };
}

/** Text/ink color (sticky/frame keep fill as background). */
export function textColorPatchForObject(obj: CanvasObject, color: string): Partial<CanvasObject> {
  if (obj.type === 'sticky' || obj.type === 'frame') return { textColor: color };
  if (obj.type === 'text' || obj.type === 'stamp') return { fill: color };
  return colorPatchForObject(obj, color);
}

export function supportsFillColor(obj: CanvasObject): boolean {
  return obj.type !== 'image' && obj.type !== 'audio';
}

export function supportsTextStyle(obj: CanvasObject): boolean {
  return obj.type === 'text' || obj.type === 'sticky' || obj.type === 'frame' || obj.type === 'stamp';
}

export function supportsFontSize(obj: CanvasObject): boolean {
  return obj.type === 'text' || obj.type === 'sticky' || obj.type === 'frame';
}

export function supportsStrokeWidth(obj: CanvasObject): boolean {
  return STROKE_WIDTH_TYPES.has(obj.type);
}

export function effectiveStrokeWidth(obj: CanvasObject): number {
  if (typeof obj.strokeWidth === 'number') return obj.strokeWidth;
  if (obj.type === 'path' || obj.type === 'rope') return 4;
  if (obj.type === 'line' || obj.type === 'arrow' || obj.type === 'elbowArrow' || obj.type === 'connector') {
    return 2;
  }
  if (obj.stroke && !isNoFill(obj.stroke)) return DEFAULT_SHAPE_STROKE_WIDTH;
  return 0;
}

/** Patch when changing border/line thickness from the selection toolbar. */
export function strokeWidthPatchForObject(obj: CanvasObject, width: number): Partial<CanvasObject> {
  const strokeWidth = Math.max(0, Math.min(24, Math.round(width)));
  if (strokeWidth <= 0) {
    return { strokeWidth: 0 };
  }
  const ink = obj.stroke && !isNoFill(obj.stroke) ? obj.stroke : DEFAULT_OUTLINE;
  if (
    obj.type === 'path' ||
    obj.type === 'connector' ||
    obj.type === 'rope' ||
    obj.type === 'line' ||
    obj.type === 'arrow' ||
    obj.type === 'elbowArrow' ||
    obj.type === 'divider' ||
    obj.type === 'blockArrow'
  ) {
    return { strokeWidth, stroke: ink, fill: ink };
  }
  if (!obj.stroke || isNoFill(obj.stroke) || isNoFill(obj.fill)) {
    return { strokeWidth, stroke: ink };
  }
  return { strokeWidth };
}

export function effectiveFontSize(obj: CanvasObject): number {
  if (obj.type === 'code') return obj.fontSize ?? 14;
  if (obj.type === 'sticky') return obj.fontSize ?? 18;
  if (obj.type === 'frame') return obj.fontSize ?? 16;
  return obj.fontSize ?? DEFAULT_FONT_SIZE;
}

export function effectiveFontFamily(obj: CanvasObject): string {
  return fontStackFor(obj.fontFamily) || DEFAULT_FONT_STACK;
}

export function effectiveAlign(obj: CanvasObject): TextAlign {
  return obj.align ?? 'left';
}

export function isBold(obj: CanvasObject): boolean {
  return (obj.fontStyle ?? '').includes('bold');
}

export function isItalic(obj: CanvasObject): boolean {
  return (obj.fontStyle ?? '').includes('italic');
}

export function isUnderline(obj: CanvasObject): boolean {
  return (obj.textDecoration ?? '').includes('underline');
}

export function isStrike(obj: CanvasObject): boolean {
  return (obj.textDecoration ?? '').includes('line-through');
}

export function toggleBoldStyle(current?: string): string {
  const italic = (current ?? '').includes('italic');
  const bold = (current ?? '').includes('bold');
  if (bold && italic) return 'italic';
  if (bold) return 'normal';
  if (italic) return 'bold italic';
  return 'bold';
}

export function toggleItalicStyle(current?: string): string {
  const italic = (current ?? '').includes('italic');
  const bold = (current ?? '').includes('bold');
  if (bold && italic) return 'bold';
  if (italic) return 'normal';
  if (bold) return 'bold italic';
  return 'italic';
}

export function toggleTextDecoration(current: string | undefined, flag: 'underline' | 'line-through'): string {
  const parts = new Set((current ?? '').split(/\s+/).filter(Boolean));
  if (parts.has(flag)) parts.delete(flag);
  else parts.add(flag);
  if (parts.size === 0) return 'none';
  return [...parts].join(' ');
}

export function cycleAlign(current?: TextAlign): TextAlign {
  if (current === 'left') return 'center';
  if (current === 'center') return 'right';
  return 'left';
}

export function effectiveListStyle(obj: CanvasObject): 'none' | 'bullet' | 'numbered' {
  return obj.listStyle ?? 'none';
}

export function effectiveIndent(obj: CanvasObject): number {
  return Math.max(0, Math.min(6, obj.indent ?? 0));
}

/** Visible text including list markers / indent (canvas + export). */
export function formattedTextContent(obj: CanvasObject, fallback = ''): string {
  const raw = (obj.text && obj.text.length > 0 ? obj.text : fallback) || '';
  const indent = '  '.repeat(effectiveIndent(obj));
  const style = effectiveListStyle(obj);
  const lines = raw.split('\n');
  return lines
    .map((line, i) => {
      const body = line;
      if (style === 'bullet') return `${indent}${body ? `• ${body}` : ''}`;
      if (style === 'numbered') return `${indent}${body ? `${i + 1}. ${body}` : ''}`;
      return `${indent}${body}`;
    })
    .join('\n');
}

export function clampIndent(n: number): number {
  return Math.max(0, Math.min(6, Math.round(n)));
}

export function effectiveTextColor(obj: CanvasObject): string {
  if (obj.type === 'code') return obj.textColor ?? CODE_TEXT;
  if (obj.type === 'sticky') return obj.textColor ?? '#2b2b2b';
  if (obj.type === 'frame') return obj.textColor ?? obj.stroke ?? GRAVITY.link;
  return obj.fill;
}

export function effectiveOpacity(obj: CanvasObject): number {
  return typeof obj.opacity === 'number' ? obj.opacity : 1;
}
