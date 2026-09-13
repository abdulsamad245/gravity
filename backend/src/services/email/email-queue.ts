import { config } from '../../config/config';
import { logger } from '../../observability/logger';
import { BullMqEmailQueue } from './bullmq-email-queue';
import type { EmailQueue } from './email-queue.types';
import { MemoryEmailQueue } from './memory-email-queue';

export type { EmailJobMeta, EmailQueue } from './email-queue.types';

function createEmailQueue(): EmailQueue {
  // Unit tests stay on the in-memory driver (no Redis required).
  if (config.NODE_ENV === 'test' || !config.redisUrl) {
    if (config.NODE_ENV !== 'test') {
      logger.info(
        { event: 'email_queue_memory', reason: 'REDIS_URL unset' },
        'Invite email queue using in-memory driver (set REDIS_URL for BullMQ)',
      );
    }
    return new MemoryEmailQueue();
  }

  try {
    return new BullMqEmailQueue(config.redisUrl);
  } catch (err) {
    logger.error(
      { err, event: 'email_queue_bullmq_init_failed' },
      'BullMQ email queue failed to start; falling back to in-memory queue',
    );
    return new MemoryEmailQueue();
  }
}

/** Shared invite mail queue: BullMQ when REDIS_URL is set, otherwise in-memory. */
export const emailQueue: EmailQueue = createEmailQueue();
