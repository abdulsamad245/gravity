import type { Request, Response } from 'express';
import { roomPersistenceService } from '../services/room-persistence.service';
import { roomService } from '../services/room.service';
import { ApiResponse } from '../shared/http/api-response';

/** Lightweight collision check for client-side room id allocation. */
export async function getRoomExists(req: Request, res: Response): Promise<void> {
  const room = req.params.room as string;
  const live = roomService.isLive(room);
  const persisted = live ? true : await roomPersistenceService.hasSnapshot(room);
  ApiResponse.ok(res, { room, exists: live || persisted });
}
