import { z } from 'zod';
import { ROOM_NAME_REGEX } from '../constants/app.constants';

export const roomParamsSchema = z.object({
  room: z.string().regex(ROOM_NAME_REGEX, 'Invalid room name'),
});

export type RoomParams = z.infer<typeof roomParamsSchema>;
