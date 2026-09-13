import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config/config';
import type { OrbitGapReason } from '../llm/orbit-product-help';
import { logger } from '../observability/logger';

/**
 * Logs unanswered Orbit turns: structured pino event plus append-only NDJSON
 * under DATA_DIR for prompt/FAQ review. Prompt/reply previews are truncated.
 */
export type OrbitFeedbackEvent = {
  event: 'orbit_unanswered' | 'orbit_knowledge_gap';
  reason: OrbitGapReason | string;
  roomId?: string;
  promptPreview: string;
  replyPreview?: string;
  provider?: string;
  model?: string;
  hadOps?: boolean;
  at: string;
};

function preview(text: string, max = 240): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

class OrbitFeedbackService {
  private readonly dir: string | null;
  private writeChain: Promise<void> = Promise.resolve();

  constructor(dataDir?: string) {
    this.dir = dataDir ? path.resolve(dataDir, 'orbit-feedback') : null;
  }

  record(input: Omit<OrbitFeedbackEvent, 'at' | 'promptPreview' | 'replyPreview'> & {
    prompt: string;
    reply?: string;
  }): void {
    const entry: OrbitFeedbackEvent = {
      event: input.event,
      reason: input.reason,
      roomId: input.roomId,
      promptPreview: preview(input.prompt),
      replyPreview: input.reply ? preview(input.reply) : undefined,
      provider: input.provider,
      model: input.model,
      hadOps: input.hadOps,
      at: new Date().toISOString(),
    };

    logger.info(
      {
        event: entry.event,
        reason: entry.reason,
        roomId: entry.roomId,
        provider: entry.provider,
        hadOps: entry.hadOps,
        promptPreview: entry.promptPreview,
      },
      'Orbit knowledge gap logged for review',
    );

    if (!this.dir) return;
    const line = `${JSON.stringify(entry)}\n`;
    const file = path.join(this.dir, `${entry.at.slice(0, 10)}.ndjson`);
    this.writeChain = this.writeChain
      .then(async () => {
        await mkdir(this.dir!, { recursive: true });
        await appendFile(file, line, 'utf8');
      })
      .catch((err) => {
        logger.warn({ err, event: 'orbit_feedback_write_failed' }, 'Failed to persist Orbit feedback');
      });
  }
}

export const orbitFeedbackService = new OrbitFeedbackService(config.DATA_DIR);
