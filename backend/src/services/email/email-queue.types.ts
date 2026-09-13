import type { OutboundEmail } from './email.transport';

/** Metadata attached to queued outbound mail (logging / retries). */
export interface EmailJobMeta {
  kind: 'invite';
  roomId?: string;
}

/**
 * Invite email queue seam (BullMQ or in-memory).
 * `enqueue` returns false when the queue is full; `flush` drains on shutdown.
 */
export interface EmailQueue {
  readonly pendingCount: number;
  readonly activeCount: number;
  enqueue(mail: OutboundEmail, meta: EmailJobMeta): boolean;
  flush(timeoutMs?: number): Promise<void>;
  /** Test helper: reopen after flush / isolate suites. */
  resetForTests(): void;
}
