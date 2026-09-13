import { Router } from 'express';
import { getReplayLog } from '../controllers/replay.controller';
import { validateParams } from '../middleware/validate.middleware';
import { roomParamsSchema } from '../validators/room.validators';

export const replayRouter = Router();

/**
 * @openapi
 * /api/v1/replay/{room}:
 *   get:
 *     summary: Get the recorded session log for a room (time-travel replay)
 *     description: >
 *       Returns every Yjs update recorded for the room, each with a timestamp
 *       and a base64-encoded binary patch. Applying the entries in order to a
 *       fresh Yjs document reproduces the entire session from the beginning.
 *     tags: [Replay]
 *     parameters:
 *       - $ref: '#/components/parameters/RoomId'
 *     responses:
 *       200:
 *         description: The recorded session log
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [data, meta]
 *               properties:
 *                 data: { $ref: '#/components/schemas/ReplayData' }
 *                 meta: { $ref: '#/components/schemas/Meta' }
 *       400:
 *         description: Invalid room name
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
replayRouter.get('/replay/:room', validateParams(roomParamsSchema), getReplayLog);
