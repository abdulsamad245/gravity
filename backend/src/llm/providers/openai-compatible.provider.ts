import { ApiError } from '../../types/api-error';
import type { ChatCompletionInput, LlmProvider } from '../types';

/**
 * OpenAI Chat Completions API shape — also works with Groq, Azure OpenAI (compat),
 * Ollama, and other OpenAI-compatible gateways by changing baseUrl + model.
 */
export class OpenAiCompatibleProvider implements LlmProvider {
  readonly id: string;

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
    id = 'openai_compatible',
  ) {
    this.id = id;
  }

  private completionsUrl(): string {
    return `${this.baseUrl.replace(/\/$/, '')}/chat/completions`;
  }

  private mapFetchError(err: unknown): never {
    if (err instanceof ApiError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiError(504, 'LLM_TIMEOUT', 'The assistant took too long. Try again.');
    }
    throw new ApiError(502, 'LLM_UPSTREAM_ERROR', 'The assistant could not complete that request.');
  }

  private async assertOk(res: Response): Promise<void> {
    if (res.status === 429) {
      throw new ApiError(429, 'LLM_RATE_LIMITED', 'The assistant is busy. Try again shortly.');
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new ApiError(
        502,
        'LLM_UPSTREAM_ERROR',
        'The assistant could not complete that request.',
        { status: res.status, detail: detail.slice(0, 200) },
      );
    }
  }

  async complete(input: ChatCompletionInput): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs);

    try {
      const res = await fetch(this.completionsUrl(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: input.model,
          messages: input.messages,
          max_tokens: input.maxTokens,
          temperature: input.temperature,
        }),
        signal: controller.signal,
      });

      await this.assertOk(res);

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const text = data.choices?.[0]?.message?.content?.trim();
      if (!text) {
        throw new ApiError(502, 'LLM_EMPTY', 'The assistant returned an empty reply.');
      }
      return text;
    } catch (err) {
      this.mapFetchError(err);
    } finally {
      clearTimeout(timer);
    }
  }

  async *stream(input: ChatCompletionInput): AsyncGenerator<string, void, undefined> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), input.timeoutMs);
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

    try {
      const res = await fetch(this.completionsUrl(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: input.model,
          messages: input.messages,
          max_tokens: input.maxTokens,
          temperature: input.temperature,
          stream: true,
        }),
        signal: controller.signal,
      });

      await this.assertOk(res);

      if (!res.body) {
        throw new ApiError(502, 'LLM_EMPTY', 'The assistant returned an empty reply.');
      }

      reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (!payload) continue;
          if (payload === '[DONE]') return;
          try {
            const json = JSON.parse(payload) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const piece = json.choices?.[0]?.delta?.content;
            if (piece) yield piece;
          } catch {
            // Skip malformed SSE chunks from upstream.
          }
        }
      }
    } catch (err) {
      this.mapFetchError(err);
    } finally {
      clearTimeout(timer);
      reader?.releaseLock();
    }
  }
}
