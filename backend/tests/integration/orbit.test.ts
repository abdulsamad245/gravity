import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { createApp } from '../../src/app';
import {
  LLM_MAX_ATTACHMENT_BYTES,
  LLM_MAX_ATTACHMENTS,
  LLM_MAX_PROMPT_CHARS,
} from '../../src/constants/llm.constants';

let app: Express;

beforeAll(() => {
  app = createApp();
});

describe('POST /api/v1/orbit/chat limits', () => {
  it('rejects oversized prompts with the validation envelope', async () => {
    const res = await request(app)
      .post('/api/v1/orbit/chat')
      .send({ prompt: 'a'.repeat(LLM_MAX_PROMPT_CHARS + 1) })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.meta.requestId).toBeTypeOf('string');
  });

  it('rejects too many attachments', async () => {
    const attachments = Array.from({ length: LLM_MAX_ATTACHMENTS + 1 }, (_, i) => ({
      name: `file-${i}.txt`,
      type: 'text/plain',
      size: 20,
      extractedText: 'hi',
    }));
    const res = await request(app)
      .post('/api/v1/orbit/chat')
      .send({ prompt: 'cluster these', attachments })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects oversized attachment size claims', async () => {
    const res = await request(app)
      .post('/api/v1/orbit/chat')
      .send({
        prompt: 'read this',
        attachments: [
          {
            name: 'big.txt',
            type: 'text/plain',
            size: LLM_MAX_ATTACHMENT_BYTES + 1,
            extractedText: 'nope',
          },
        ],
      })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects video uploads', async () => {
    const res = await request(app)
      .post('/api/v1/orbit/chat')
      .send({
        prompt: 'watch this',
        attachments: [{ name: 'clip.mp4', type: 'video/mp4', size: 500 }],
      })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects empty prompt with no attachments', async () => {
    const res = await request(app).post('/api/v1/orbit/chat').send({ prompt: '' }).expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('POST /api/v1/orbit/chat/stream limits', () => {
  it('rejects oversized prompts before streaming starts', async () => {
    const res = await request(app)
      .post('/api/v1/orbit/chat/stream')
      .send({ prompt: 'b'.repeat(LLM_MAX_PROMPT_CHARS + 10) })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
