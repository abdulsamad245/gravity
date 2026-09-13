import { describe, expect, it } from 'vitest';
import {
  expandAffirmativeFollowUp,
  extractPendingOffer,
  isShortAffirmation,
} from '../../src/llm/orbit-followup';

describe('orbit-followup', () => {
  it('detects short affirmations', () => {
    expect(isShortAffirmation('yes')).toBe(true);
    expect(isShortAffirmation('OK')).toBe(true);
    expect(isShortAffirmation('go ahead')).toBe(true);
    expect(isShortAffirmation('yeah')).toBe(true);
    expect(isShortAffirmation('add a sticky')).toBe(false);
  });

  it('extracts pending offers from assistant turns', () => {
    expect(
      extractPendingOffer('Laser is a pointer. Would you like me to add a laser line to your board?'),
    ).toMatch(/add a laser line/i);
    expect(extractPendingOffer('Shall I build a kanban?')).toMatch(/build a kanban/i);
  });

  it('expands yes using the last assistant offer', () => {
    const expanded = expandAffirmativeFollowUp('yes', [
      { role: 'user', text: 'What is laser for?' },
      {
        role: 'assistant',
        text: 'Laser is a live pointer. Would you like me to add a laser line to your board?',
      },
    ]);
    expect(expanded).toMatch(/proceed with what you just offered: add a laser line/i);
  });

  it('leaves non-affirmations unchanged', () => {
    expect(
      expandAffirmativeFollowUp('cluster the stickies', [
        { role: 'assistant', text: 'Would you like me to summarize?' },
      ]),
    ).toBe('cluster the stickies');
  });
});
