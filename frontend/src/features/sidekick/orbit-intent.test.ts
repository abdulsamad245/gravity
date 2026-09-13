import { describe, expect, it } from 'vitest';
import {
  expandAffirmativeFollowUp,
  extractListedNames,
  extractPendingOffer,
  isShortAffirmation,
  resolveAffirmationLocalIntent,
  resolveColorToken,
  resolveLocalOrbitIntent,
  resolveProductSupportIntent,
} from './orbit-intent';

describe('Orbit product support intents', () => {
  it('answers where the kanban and table tools are without selection', () => {
    expect(resolveProductSupportIntent('where is the kanban tool')?.reply).toMatch(/Kanban/i);
    expect(resolveProductSupportIntent('where is the table tool')?.reply).toMatch(/More shapes/i);
    expect(resolveProductSupportIntent('where is kanban and table')?.reply).toMatch(/Table/i);
  });

  it('runs support before requiring a selection', () => {
    const local = resolveLocalOrbitIntent('Where is the table tool?', [], []);
    expect(local?.ops).toEqual([]);
    expect(local?.reply).toMatch(/Building tools/i);
  });

  it('explains laser without offering a permanent board object', () => {
    expect(resolveProductSupportIntent('whats the laser tool for')?.reply).toMatch(
      /live facilitation pointer|not saved/i,
    );
  });

  it('covers more-tools and common toolbar how-tos', () => {
    expect(resolveProductSupportIntent('where is the connector tool')?.reply).toMatch(/Connect/i);
    expect(resolveProductSupportIntent('how do I use attract')?.reply).toMatch(/Attract/i);
    expect(resolveProductSupportIntent('where is rope')?.reply).toMatch(/Rope/i);
    expect(resolveProductSupportIntent('how do I use repel')?.reply).toMatch(/Repel/i);
    expect(resolveProductSupportIntent('how do I attract or repel objects')?.reply).toMatch(
      /Attract and Repel/i,
    );
    expect(resolveProductSupportIntent('what is board gravity')?.reply).toMatch(/Gravity/i);
    expect(resolveProductSupportIntent('how does board gravity work')?.reply).toMatch(/fall and stack/i);
    expect(resolveProductSupportIntent('how is voting done')?.reply).toMatch(/Facilitate/i);
    expect(resolveProductSupportIntent('how do I vote')?.reply).toMatch(/Vote/i);
    expect(resolveProductSupportIntent('where is stamp')?.reply).toMatch(/Stamp/i);
    expect(resolveProductSupportIntent('how do I add an image')?.reply).toMatch(/image/i);
    expect(resolveProductSupportIntent('where is the timer')?.reply).toMatch(/Facilitate/i);
    expect(resolveProductSupportIntent('where is web embed')?.reply).toMatch(/embed/i);
    expect(resolveProductSupportIntent('where are stickers')?.reply).toMatch(/smiley/i);
    expect(resolveProductSupportIntent('where is mind map')?.reply).toMatch(/Mind map/i);
    expect(resolveProductSupportIntent('where is the code block')?.reply).toMatch(/code/i);
    expect(resolveProductSupportIntent('where is more tools')?.reply).toMatch(/Physics|More tools/i);
    expect(resolveProductSupportIntent('where is session replay')?.reply).toMatch(/clapperboard/i);
    expect(resolveProductSupportIntent('where is present mode')?.reply).toMatch(/Present/i);
    expect(resolveProductSupportIntent('where is the voice note')?.reply).toMatch(/mic/i);
    expect(resolveProductSupportIntent('how do I raise hand')?.reply).toMatch(/Facilitate/i);
    expect(resolveProductSupportIntent('where is install')?.reply).toMatch(/Install|More/i);
    expect(resolveProductSupportIntent('where is dark mode')?.reply).toMatch(/More/i);
  });

  it('attaches Show me guides for toolbar how-tos', () => {
    expect(resolveProductSupportIntent('where is rope')?.guide).toMatchObject({
      label: 'Show Rope',
      reveal: 'physics',
    });
    expect(resolveProductSupportIntent('where is the connector tool')?.guide?.selector).toMatch(
      /connect/,
    );
    expect(resolveProductSupportIntent('where is the code block')?.guide?.label).toMatch(/Code/i);
    expect(resolveProductSupportIntent('where is the timer')?.guide?.reveal).toBe('facilitate');
    expect(resolveProductSupportIntent('where is physics')?.guide?.reveal).toBe('physics');
    expect(resolveProductSupportIntent('where is session replay')?.guide?.selector).toMatch(/replay/);
  });

  it('does not hijack board-create prompts as how-tos', () => {
    expect(resolveProductSupportIntent('create a kanban board on the canvas now')).toBeNull();
    expect(resolveProductSupportIntent('build a sticky brainstorm')).toBeNull();
    expect(resolveLocalOrbitIntent('Create a kanban board', [], [])).toBeNull();
  });
});

describe('Orbit affirmative follow-ups', () => {
  const history = [
    { role: 'user' as const, text: 'Whats the laser tool for?' },
    {
      role: 'assistant' as const,
      text: 'Laser is a facilitation pointer. Would you like me to add a laser line to your board?',
    },
  ];

  it('detects short affirmations', () => {
    expect(isShortAffirmation('yes')).toBe(true);
    expect(isShortAffirmation('sure')).toBe(true);
    expect(isShortAffirmation('go ahead')).toBe(true);
    expect(isShortAffirmation('cluster stickies')).toBe(false);
  });

  it('extracts pending offers from assistant questions', () => {
    expect(extractPendingOffer(history[1].text)).toMatch(/add a laser line/i);
  });

  it('expands yes into the prior offer', () => {
    expect(expandAffirmativeFollowUp('yes', history)).toMatch(/proceed.*laser line/i);
    expect(expandAffirmativeFollowUp('cluster please', history)).toBe('cluster please');
  });

  it('answers laser affirmations locally instead of inventing board ops', () => {
    const local = resolveAffirmationLocalIntent('yes', history);
    expect(local?.ops).toEqual([]);
    expect(local?.reply).toMatch(/not saved|live facilitation pointer/i);
  });

  it('leaves board-building affirmations for the LLM', () => {
    const buildHistory = [
      {
        role: 'assistant' as const,
        text: 'I can place a kanban board. Would you like me to build a kanban?',
      },
    ];
    expect(resolveAffirmationLocalIntent('yes', buildHistory)).toBeNull();
    expect(expandAffirmativeFollowUp('ok', buildHistory)).toMatch(/build a kanban/i);
  });
});

describe('Orbit local board edits', () => {
  const selected = [{ id: 's1', type: 'sticky', label: 'Idea', fill: '#ffd43b', text: 'Idea' }];

  it('resolves color typos and applies fill ops', () => {
    expect(resolveColorToken('toiblie')?.name).toBe('blue');
    const local = resolveLocalOrbitIntent('make it blue', selected, []);
    expect(local?.ops).toEqual([{ op: 'update', id: 's1', patch: { fill: '#3d8bfd' } }]);
  });

  it('deletes selected items', () => {
    const local = resolveLocalOrbitIntent('delete this', selected, []);
    expect(local?.ops).toEqual([{ op: 'delete', id: 's1' }]);
  });

  it('labels recent items from earlier listed names', () => {
    const recent = [
      { id: 'a', type: 'rect', label: 'a' },
      { id: 'b', type: 'rect', label: 'b' },
      { id: 'c', type: 'rect', label: 'c' },
    ];
    expect(extractListedNames('flowchart with Start, Work, Done')).toEqual([
      'Start',
      'Work',
      'Done',
    ]);
    const local = resolveLocalOrbitIntent('add labels to them', [], recent, 'with Start, Work, Done');
    expect(local?.ops).toEqual([
      { op: 'update', id: 'a', patch: { text: 'Start' } },
      { op: 'update', id: 'b', patch: { text: 'Work' } },
      { op: 'update', id: 'c', patch: { text: 'Done' } },
    ]);
  });

  it('returns null when there are no targets for edits', () => {
    expect(resolveLocalOrbitIntent('make it blue', [], [])).toBeNull();
  });
});
