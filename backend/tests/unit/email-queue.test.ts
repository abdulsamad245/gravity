import { afterEach, describe, expect, it, vi } from 'vitest';
import { emailQueue } from '../../src/services/email/email-queue';
import * as transport from '../../src/services/email/email.transport';

/** Unit suite uses the in-memory driver (NODE_ENV=test). */
describe('emailQueue (memory driver)', () => {
  afterEach(async () => {
    await emailQueue.flush(2_000);
    emailQueue.resetForTests();
    vi.restoreAllMocks();
  });

  it('delivers enqueued mail through the transport', async () => {
    const send = vi.spyOn(transport, 'sendEmail').mockResolvedValue('sent');

    expect(
      emailQueue.enqueue(
        {
          to: 'a@example.com',
          subject: 'Hello',
          text: 'Hi',
          html: '<p>Hi</p>',
        },
        { kind: 'invite', roomId: 'room1' },
      ),
    ).toBe(true);

    await emailQueue.flush(2_000);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]?.to).toBe('a@example.com');
  });

  it('retries on transport failure then succeeds', async () => {
    const send = vi
      .spyOn(transport, 'sendEmail')
      .mockRejectedValueOnce(new Error('smtp down'))
      .mockResolvedValueOnce('sent');

    emailQueue.enqueue(
      {
        to: 'b@example.com',
        subject: 'Retry',
        text: 'Hi',
        html: '<p>Hi</p>',
      },
      { kind: 'invite' },
    );

    // Wait for attempt 1 fail + backoff + attempt 2 (flush alone can race the sleep).
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2), { timeout: 5_000 });
    await emailQueue.flush(2_000);
  });

  it('rejects new jobs after flush closes the queue', async () => {
    await emailQueue.flush(100);
    const ok = emailQueue.enqueue(
      {
        to: 'c@example.com',
        subject: 'Nope',
        text: 'x',
        html: 'x',
      },
      { kind: 'invite' },
    );
    expect(ok).toBe(false);
    emailQueue.resetForTests();
  });
});
