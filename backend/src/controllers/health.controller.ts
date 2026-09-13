import type { Request, Response } from 'express';
import type { HealthResponseDto } from '../dto/health.dto';
import { roomService } from '../services/room.service';
import { ApiResponse } from '../shared/http/api-response';

/** Liveness probe plus live room/client counts from the y-websocket registry. */
export function getHealth(_req: Request, res: Response): void {
  const body: HealthResponseDto = {
    status: 'ok',
    uptimeSeconds: Math.round(process.uptime()),
    rooms: roomService.roomCount(),
    clients: roomService.clientCount(),
  };
  ApiResponse.ok(res, body);
}
