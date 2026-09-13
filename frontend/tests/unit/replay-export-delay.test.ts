import { describe, expect, it } from 'vitest';
import { ReplayController } from '../../src/features/replay/ReplayController';
import { replayExportStepDelayMs } from '../../src/features/replay/replay-export-timing';

describe('replayExportStepDelayMs', () => {
  it('does not throw on the final frame past the last entry', () => {
    const controller = new ReplayController([
      { t: 1_000, u: 'AA==' },
      { t: 1_200, u: 'AA==' },
      { t: 2_000, u: 'AA==' },
    ]);
    expect(() => replayExportStepDelayMs(controller, controller.length)).not.toThrow();
    expect(replayExportStepDelayMs(controller, controller.length)).toBeGreaterThan(0);
  });

  it('uses the gap between consecutive entries for mid-session steps', () => {
    const controller = new ReplayController([
      { t: 1_000, u: 'AA==' },
      { t: 1_200, u: 'AA==' },
    ]);
    // 200ms gap / export scale 4 = 50ms
    expect(replayExportStepDelayMs(controller, 1)).toBe(50);
  });
});
