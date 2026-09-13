import { REPLAY_START_HOLD_MS } from '../../shared/constants/replay.constants';
import type { ReplayController } from './ReplayController';

/** Cap long gaps so quiet stretches do not make huge videos. */
const MAX_STEP_MS = 1_200;
/** Brief hold on the fully rebuilt board at the end of the export. */
const FINAL_HOLD_MS = 400;
/** Export faster than realtime while keeping relative pacing. */
const EXPORT_TIME_SCALE = 4;

/** Delay between export frames (ms). Safe for the final index === length. */
export function replayExportStepDelayMs(controller: ReplayController, index: number): number {
  if (index <= 0) return Math.min(REPLAY_START_HOLD_MS, MAX_STEP_MS) / EXPORT_TIME_SCALE;
  // Final frame (index === length) has no "next" entry — hold briefly instead.
  if (index >= controller.length) {
    return Math.min(FINAL_HOLD_MS, MAX_STEP_MS) / EXPORT_TIME_SCALE;
  }
  const prev = controller.entries[index - 1]!.t;
  const next = controller.entries[index]!.t;
  const gap = Math.max(40, Math.min(MAX_STEP_MS, next - prev));
  return gap / EXPORT_TIME_SCALE;
}
