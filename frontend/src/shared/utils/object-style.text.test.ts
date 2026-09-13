import { describe, expect, it } from 'vitest';
import type { CanvasObject } from '../types';
import {
  formattedTextContent,
  toggleItalicStyle,
  toggleTextDecoration,
} from './object-style';

function textObj(partial: Partial<CanvasObject>): CanvasObject {
  return {
    id: 't1',
    type: 'text',
    x: 0,
    y: 0,
    width: 120,
    height: 40,
    rotation: 0,
    fill: '#12141a',
    z: 1,
    text: 'Hello',
    ...partial,
  };
}

describe('text style helpers', () => {
  it('toggles italic while preserving bold', () => {
    expect(toggleItalicStyle('bold')).toBe('bold italic');
    expect(toggleItalicStyle('bold italic')).toBe('bold');
  });

  it('toggles underline and strikethrough independently', () => {
    expect(toggleTextDecoration(undefined, 'underline')).toBe('underline');
    expect(toggleTextDecoration('underline', 'line-through')).toContain('underline');
    expect(toggleTextDecoration('underline', 'line-through')).toContain('line-through');
    expect(toggleTextDecoration('underline line-through', 'underline')).toBe('line-through');
  });

  it('formats bullet and numbered lists with indent', () => {
    const bullet = formattedTextContent(
      textObj({ text: 'a\nb', listStyle: 'bullet', indent: 1 }),
    );
    expect(bullet).toBe('  • a\n  • b');
    const numbered = formattedTextContent(textObj({ text: 'a\nb', listStyle: 'numbered' }));
    expect(numbered).toBe('1. a\n2. b');
  });
});
