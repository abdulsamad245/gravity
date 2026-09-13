import { describe, expect, it } from 'vitest';
import {
  LLM_MAX_ATTACHMENT_BYTES,
  LLM_MAX_ATTACHMENTS,
  LLM_MAX_PROMPT_CHARS,
  LLM_MAX_TOTAL_ATTACHMENT_TEXT,
} from '../../src/constants/llm.constants';
import { orbitChatBodySchema } from '../../src/validators/orbit.validators';

describe('orbitChatBodySchema', () => {
  it('accepts a normal prompt within the LLM cap', () => {
    const parsed = orbitChatBodySchema.parse({ prompt: 'Make a kanban board' });
    expect(parsed.prompt).toBe('Make a kanban board');
  });

  it('rejects prompts longer than LLM_MAX_PROMPT_CHARS', () => {
    const result = orbitChatBodySchema.safeParse({
      prompt: 'a'.repeat(LLM_MAX_PROMPT_CHARS + 1),
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty turns with no attachments', () => {
    const result = orbitChatBodySchema.safeParse({ prompt: '   ' });
    expect(result.success).toBe(false);
  });

  it('allows attachment-only turns', () => {
    const parsed = orbitChatBodySchema.parse({
      prompt: '',
      attachments: [{ name: 'notes.txt', type: 'text/plain', size: 12, extractedText: 'hello' }],
    });
    expect(parsed.attachments).toHaveLength(1);
  });

  it('rejects more than LLM_MAX_ATTACHMENTS', () => {
    const attachments = Array.from({ length: LLM_MAX_ATTACHMENTS + 1 }, (_, i) => ({
      name: `f${i}.txt`,
      type: 'text/plain',
      size: 10,
    }));
    const result = orbitChatBodySchema.safeParse({ prompt: 'hi', attachments });
    expect(result.success).toBe(false);
  });

  it('rejects oversized attachment byte claims', () => {
    const result = orbitChatBodySchema.safeParse({
      prompt: 'hi',
      attachments: [
        {
          name: 'huge.txt',
          type: 'text/plain',
          size: LLM_MAX_ATTACHMENT_BYTES + 1,
        },
      ],
    });
    expect(result.success).toBe(false);
  });

  it('rejects video attachments', () => {
    const result = orbitChatBodySchema.safeParse({
      prompt: 'hi',
      attachments: [{ name: 'clip.mp4', type: 'video/mp4', size: 100 }],
    });
    expect(result.success).toBe(false);
  });

  it('rejects total extracted text above the LLM budget', () => {
    const chunk = 'x'.repeat(LLM_MAX_TOTAL_ATTACHMENT_TEXT / 2 + 1);
    const result = orbitChatBodySchema.safeParse({
      prompt: 'summarize',
      attachments: [
        { name: 'a.txt', type: 'text/plain', size: 10, extractedText: chunk },
        { name: 'b.txt', type: 'text/plain', size: 10, extractedText: chunk },
      ],
    });
    expect(result.success).toBe(false);
  });
});
