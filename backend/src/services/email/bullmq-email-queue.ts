import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { config } from '../../config/config';
import { logger } from '../../observability/logger';
import type { EmailJobMeta, EmailQueue } from './email-queue.types';
import { sendEmail, type OutboundEmail } from './email.transport';

interface InviteEmailJobData {
  mail: OutboundEmail;
  meta: EmailJobMeta;
  enqueuedAt: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    t.unref?.();
  });
}

function createRedis(redisUrl: string): IORedis {
  const client = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
  client.on('error', (err) => {
    logger.error({ err, event: 'email_redis_error', driver: 'bullmq' }, 'Redis connection error');
  });
  return client;
}

/**
 * Durable invite mail via BullMQ + Redis. Worker runs in-process; jobs survive restarts.
 */
export class BullMqEmailQueue implements EmailQueue {
  private readonly queueConnection: IORedis;
  private readonly workerConnection: IORedis;
  private readonly queue: Queue<InviteEmailJobData>;
  private readonly worker: Worker<InviteEmailJobData>;
  private closed = false;
  private counts = { pending: 0, active: 0 };

  constructor(redisUrl: string) {
    this.queueConnection = createRedis(redisUrl);
    this.workerConnection = createRedis(redisUrl);

    this.queue = new Queue<InviteEmailJobData>(config.EMAIL_QUEUE_NAME, {
      connection: this.queueConnection,
      defaultJobOptions: {
        attempts: config.EMAIL_QUEUE_MAX_ATTEMPTS,
        backoff: { type: 'fixed', delay: config.EMAIL_QUEUE_RETRY_BASE_MS },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    });

    this.worker = new Worker<InviteEmailJobData>(
      config.EMAIL_QUEUE_NAME,
      async (job) => this.process(job),
      {
        connection: this.workerConnection,
        concurrency: config.EMAIL_QUEUE_CONCURRENCY,
      },
    );

    this.worker.on('completed', (job, result: 'sent' | 'deferred') => {
      logger.info(
        {
          event: result === 'deferred' ? 'email_queue_deferred' : 'email_queue_sent',
          jobId: job.id,
          to: job.data.mail.to,
          kind: job.data.meta.kind,
          roomId: job.data.meta.roomId,
          attempts: job.attemptsMade,
          waitMs: Date.now() - job.data.enqueuedAt,
          driver: 'bullmq',
        },
        result === 'deferred' ? 'Queued email deferred (no SMTP)' : 'Queued email sent',
      );
      void this.refreshCounts();
    });

    this.worker.on('failed', (job, err) => {
      const attempts = job?.attemptsMade ?? 0;
      const permanent = attempts >= config.EMAIL_QUEUE_MAX_ATTEMPTS;
      logger[permanent ? 'error' : 'warn'](
        {
          err,
          event: permanent ? 'email_queue_failed' : 'email_queue_retry',
          jobId: job?.id,
          to: job?.data.mail.to,
          kind: job?.data.meta.kind,
          roomId: job?.data.meta.roomId,
          attempts,
          driver: 'bullmq',
        },
        permanent ? 'Email permanently failed after retries' : 'Email send failed; BullMQ will retry',
      );
      void this.refreshCounts();
    });

    void this.refreshCounts();
    logger.info(
      { event: 'email_queue_ready', driver: 'bullmq', redisUrl: redactRedisUrl(redisUrl) },
      'BullMQ email queue ready',
    );
  }

  get pendingCount(): number {
    return this.counts.pending;
  }

  get activeCount(): number {
    return this.counts.active;
  }

  enqueue(mail: OutboundEmail, meta: EmailJobMeta): boolean {
    if (this.closed) {
      logger.warn(
        { event: 'email_queue_closed', to: mail.to, kind: meta.kind, driver: 'bullmq' },
        'Email rejected: queue closed for shutdown',
      );
      return false;
    }
    if (this.counts.pending >= config.EMAIL_QUEUE_MAX_PENDING) {
      logger.error(
        {
          event: 'email_queue_full',
          to: mail.to,
          kind: meta.kind,
          pending: this.counts.pending,
          driver: 'bullmq',
        },
        'Email rejected: queue at capacity',
      );
      return false;
    }

    void this.queue
      .add('invite', { mail, meta, enqueuedAt: Date.now() })
      .then(() => {
        logger.info(
          {
            event: 'email_queued',
            to: mail.to,
            kind: meta.kind,
            roomId: meta.roomId,
            driver: 'bullmq',
          },
          'Email enqueued for delivery',
        );
        return this.refreshCounts();
      })
      .catch((err: unknown) => {
        logger.error(
          { err, event: 'email_queue_enqueue_failed', to: mail.to, driver: 'bullmq' },
          'Failed to enqueue email on BullMQ',
        );
      });

    return true;
  }

  async flush(timeoutMs = config.EMAIL_QUEUE_FLUSH_TIMEOUT_MS): Promise<void> {
    this.closed = true;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      await this.refreshCounts();
      if (this.counts.pending === 0 && this.counts.active === 0) break;
      await sleep(150);
    }

    await this.worker.close();
    await this.queue.close();
    this.queueConnection.disconnect();
    this.workerConnection.disconnect();

    if (this.counts.pending > 0 || this.counts.active > 0) {
      logger.warn(
        {
          event: 'email_queue_flush_timeout',
          active: this.counts.active,
          pending: this.counts.pending,
          timeoutMs,
          driver: 'bullmq',
        },
        'Email queue flush timed out; remaining jobs stay in Redis for next boot',
      );
    }
  }

  resetForTests(): void {
    this.closed = false;
    this.counts = { pending: 0, active: 0 };
  }

  private async process(job: Job<InviteEmailJobData>): Promise<'sent' | 'deferred'> {
    void this.refreshCounts();
    return sendEmail(job.data.mail);
  }

  private async refreshCounts(): Promise<void> {
    try {
      const c = await this.queue.getJobCounts('waiting', 'delayed', 'active', 'paused');
      this.counts = {
        pending: (c.waiting ?? 0) + (c.delayed ?? 0) + (c.paused ?? 0),
        active: c.active ?? 0,
      };
    } catch {
      /* Redis briefly unavailable during shutdown */
    }
  }
}

function redactRedisUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return 'redis://***';
  }
}
