import { randomUUID } from 'crypto';
import { config } from '../../config/config';
import { logger } from '../../observability/logger';
import type { EmailJobMeta, EmailQueue } from './email-queue.types';
import { sendEmail, type OutboundEmail } from './email.transport';

interface EmailJob {
  id: string;
  mail: OutboundEmail;
  meta: EmailJobMeta;
  attempts: number;
  enqueuedAt: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    t.unref?.();
  });
}

/**
 * In-process fallback when Redis / BullMQ is not configured (tests, no REDIS_URL).
 */
export class MemoryEmailQueue implements EmailQueue {
  private readonly pending: EmailJob[] = [];
  private active = 0;
  private closed = false;
  private readonly drainWaiters: Array<() => void> = [];

  get pendingCount(): number {
    return this.pending.length;
  }

  get activeCount(): number {
    return this.active;
  }

  enqueue(mail: OutboundEmail, meta: EmailJobMeta): boolean {
    if (this.closed) {
      logger.warn(
        { event: 'email_queue_closed', to: mail.to, kind: meta.kind, driver: 'memory' },
        'Email rejected: queue closed for shutdown',
      );
      return false;
    }
    if (this.pending.length >= config.EMAIL_QUEUE_MAX_PENDING) {
      logger.error(
        {
          event: 'email_queue_full',
          to: mail.to,
          kind: meta.kind,
          pending: this.pending.length,
          driver: 'memory',
        },
        'Email rejected: queue at capacity',
      );
      return false;
    }

    this.pending.push({
      id: randomUUID(),
      mail,
      meta,
      attempts: 0,
      enqueuedAt: Date.now(),
    });
    logger.info(
      {
        event: 'email_queued',
        to: mail.to,
        kind: meta.kind,
        roomId: meta.roomId,
        pending: this.pending.length,
        driver: 'memory',
      },
      'Email enqueued for delivery',
    );
    this.pump();
    return true;
  }

  async flush(timeoutMs = config.EMAIL_QUEUE_FLUSH_TIMEOUT_MS): Promise<void> {
    this.closed = true;
    if (this.active === 0 && this.pending.length === 0) return;

    await Promise.race([
      new Promise<void>((resolve) => {
        this.drainWaiters.push(resolve);
        this.maybeResolveDrain();
      }),
      sleep(timeoutMs),
    ]);

    if (this.active > 0 || this.pending.length > 0) {
      logger.warn(
        {
          event: 'email_queue_flush_timeout',
          active: this.active,
          pending: this.pending.length,
          timeoutMs,
          driver: 'memory',
        },
        'Email queue flush timed out; remaining jobs dropped',
      );
      this.pending.length = 0;
    }
  }

  resetForTests(): void {
    this.closed = false;
    this.pending.length = 0;
    this.active = 0;
    this.drainWaiters.length = 0;
  }

  private pump(): void {
    while (this.active < config.EMAIL_QUEUE_CONCURRENCY && this.pending.length > 0) {
      const job = this.pending.shift();
      if (!job) break;
      this.active += 1;
      void this.run(job)
        .catch((err: unknown) => {
          logger.error({ err, event: 'email_queue_worker_crash', jobId: job.id }, 'Email worker error');
        })
        .finally(() => {
          this.active -= 1;
          this.pump();
          this.maybeResolveDrain();
        });
    }
    this.maybeResolveDrain();
  }

  private async run(job: EmailJob): Promise<void> {
    job.attempts += 1;
    try {
      const result = await sendEmail(job.mail);
      logger.info(
        {
          event: result === 'deferred' ? 'email_queue_deferred' : 'email_queue_sent',
          jobId: job.id,
          to: job.mail.to,
          kind: job.meta.kind,
          roomId: job.meta.roomId,
          attempts: job.attempts,
          waitMs: Date.now() - job.enqueuedAt,
          driver: 'memory',
        },
        result === 'deferred' ? 'Queued email deferred (no SMTP)' : 'Queued email sent',
      );
    } catch (err) {
      if (job.attempts < config.EMAIL_QUEUE_MAX_ATTEMPTS) {
        const delay = config.EMAIL_QUEUE_RETRY_BASE_MS * job.attempts;
        logger.warn(
          {
            err,
            event: 'email_queue_retry',
            jobId: job.id,
            to: job.mail.to,
            attempts: job.attempts,
            delayMs: delay,
            driver: 'memory',
          },
          'Email send failed; retrying',
        );
        await sleep(delay);
        this.pending.unshift(job);
        return;
      }
      logger.error(
        {
          err,
          event: 'email_queue_failed',
          jobId: job.id,
          to: job.mail.to,
          kind: job.meta.kind,
          roomId: job.meta.roomId,
          attempts: job.attempts,
          driver: 'memory',
        },
        'Email permanently failed after retries',
      );
    }
  }

  private maybeResolveDrain(): void {
    if (this.active !== 0 || this.pending.length !== 0) return;
    while (this.drainWaiters.length > 0) {
      this.drainWaiters.shift()?.();
    }
  }
}
