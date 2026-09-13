import { describe, expect, it } from 'vitest';
import {
  formatOrbitSelectionNote,
  prettyOrbitType,
  splitOrbitUserText,
  stripOrbitContextAppendix,
} from './orbit-context-format';

describe('orbit-context-format', () => {
  it('uses everyday type names', () => {
    expect(prettyOrbitType('text')).toBe('text');
    expect(prettyOrbitType('ellipse')).toBe('oval');
    expect(prettyOrbitType('rect')).toBe('rectangle');
  });

  it('formats a single selection in plain language', () => {
    expect(formatOrbitSelectionNote([{ type: 'text', label: 'Text' }])).toBe('Using: the text');
    expect(formatOrbitSelectionNote([{ type: 'sticky', label: 'Ship faster' }])).toBe(
      'Using: sticky "Ship faster"',
    );
  });

  it('formats several selections', () => {
    expect(
      formatOrbitSelectionNote([
        { type: 'sticky', label: 'A' },
        { type: 'text', label: 'Hello' },
      ]),
    ).toBe('Using (2): sticky "A"; text "Hello"');
  });

  it('strips legacy and new appendix from history', () => {
    expect(stripOrbitContextAppendix('Make it blue\n\nCanvas context (1): text “Text”')).toBe(
      'Make it blue',
    );
    expect(stripOrbitContextAppendix('Make it blue\n\nUsing: the text')).toBe('Make it blue');
  });

  it('splits chat display into body + using caption', () => {
    expect(splitOrbitUserText('Make it blue\n\nUsing: the text')).toEqual({
      body: 'Make it blue',
      using: 'Using: the text',
    });
    expect(splitOrbitUserText('Make it blue\n\nCanvas context (1): text “Text”').using).toMatch(
      /Using:/,
    );
  });
});
