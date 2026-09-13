import { describe, expect, it } from 'vitest';
import { parseOrbitAssistantOutput } from '../../src/llm/orbit-ops';

describe('Orbit synthesis ops', () => {
  it('accepts cluster and summarize ops from a fenced block', () => {
    const raw = [
      'Grouped and summarized the stickies.',
      '```orbit',
      JSON.stringify({
        ops: [
          {
            op: 'cluster',
            groups: [
              { title: 'Speed', objectIds: ['a1', 'a2'] },
              { title: 'Clarity', objectIds: ['b1'] },
            ],
          },
          {
            op: 'summarize',
            title: 'Takeaways',
            text: 'Ship the faster path and clarify owners.',
          },
        ],
      }),
      '```',
    ].join('\n');

    const parsed = parseOrbitAssistantOutput(raw);
    expect(parsed.reply).toContain('Grouped');
    expect(parsed.ops).toHaveLength(2);
    expect(parsed.ops[0]).toMatchObject({ op: 'cluster' });
    expect(parsed.ops[1]).toMatchObject({ op: 'summarize', title: 'Takeaways' });
  });

  it('accepts structured table records on add', () => {
    const raw = [
      'Created a kanban dataset.',
      '```orbit',
      JSON.stringify({
        ops: [
          {
            op: 'add',
            type: 'table',
            dataView: 'kanban',
            records: [
              { title: 'Ship', status: 'To do' },
              { title: 'Review', status: 'Doing' },
            ],
          },
        ],
      }),
      '```',
    ].join('\n');

    const parsed = parseOrbitAssistantOutput(raw);
    expect(parsed.ops).toHaveLength(1);
    expect(parsed.ops[0]).toMatchObject({
      op: 'add',
      type: 'table',
      dataView: 'kanban',
    });
  });
});
