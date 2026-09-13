import { z } from 'zod';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  uptimeSeconds: z.number().nonnegative(),
  rooms: z.number().int().nonnegative(),
  clients: z.number().int().nonnegative(),
});

export type HealthResponseDto = z.infer<typeof healthResponseSchema>;
