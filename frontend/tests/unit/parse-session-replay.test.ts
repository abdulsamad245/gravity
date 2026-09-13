import { describe, expect, it } from 'vitest';
import { parseSessionReplayFile } from '../../src/features/replay/parse-session-replay';

describe('parseSessionReplayFile', () => {
  it('accepts a valid session history bundle', () => {
    const result = parseSessionReplayFile(
      JSON.stringify({
        kind: 'session-replay',
        room: 'demo',
        entries: [{ t: 1, u: 'abc' }],
      }),
    );
    expect(result).toEqual({
      entries: [{ t: 1, u: 'abc' }],
      room: 'demo',
    });
  });

  it('rejects board JSON and empty logs with friendly copy + details', () => {
    expect(parseSessionReplayFile('{"objects":[]}')).toMatchObject({
      error: true,
      message: expect.stringContaining('not a session history'),
      details: expect.stringContaining('session-replay'),
    });
    expect(
      parseSessionReplayFile(JSON.stringify({ kind: 'session-replay', entries: [] })),
    ).toMatchObject({
      error: true,
      message: expect.stringContaining('no steps'),
    });
  });
});
