import { Router } from 'express';
import { getRoomExists } from '../controllers/room.controller';
import { validateParams } from '../middleware/validate.middleware';
import { roomParamsSchema } from '../validators/room.validators';

export const roomRouter = Router();

/**
 * @openapi
 * /api/v1/rooms/{room}/exists:
 *   get:
 *     summary: Check whether a room id is already in use
 *     description: >
 *       Returns exists=true when the room is live in memory or has a durable
 *       snapshot on disk. Used when allocating a fresh room id so new boards
 *       do not collide with an existing room.
 *     tags: [Rooms]
 *     parameters:
 *       - $ref: '#/components/parameters/RoomId'
 *     responses:
 *       200:
 *         description: Existence flag for the room id
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required: [data, meta]
 *               properties:
 *                 data: { $ref: '#/components/schemas/RoomExistsData' }
 *                 meta: { $ref: '#/components/schemas/Meta' }
 *       400:
 *         description: Invalid room name
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/ErrorEnvelope' }
 */
roomRouter.get('/rooms/:room/exists', validateParams(roomParamsSchema), (req, res, next) => {
  void getRoomExists(req, res).catch(next);
});
