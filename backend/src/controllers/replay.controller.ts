import type { Request, Response } from 'express';
import type { ReplayResponseDto } from '../dto/replay.dto';
import { replayLogService } from '../services/replay-log.service';
import { ApiResponse } from '../shared/http/api-response';

/** Return recorded Yjs update entries for session replay (API envelope). */
export function getReplayLog(req: Request, res: Response): void {
  const room = req.params.room as string;
  const entries = replayLogService.getLog(room);
  const body: ReplayResponseDto = { room, count: entries.length, entries };
  ApiResponse.ok(res, body);
}
