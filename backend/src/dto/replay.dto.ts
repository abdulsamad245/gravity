import { z } from 'zod';

/** One recorded Yjs update: timestamp + base64-encoded binary patch. */
export const replayLogEntrySchema = z.object({
  t: z.number().int().nonnegative(),
  u: z.string().min(1),
});

export const replayResponseSchema = z.object({
  room: z.string(),
  count: z.number().int().nonnegative(),
  entries: z.array(replayLogEntrySchema),
});

export type ReplayLogEntryDto = z.infer<typeof replayLogEntrySchema>;
export type ReplayResponseDto = z.infer<typeof replayResponseSchema>;
