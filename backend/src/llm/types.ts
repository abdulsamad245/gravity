/** Provider-agnostic chat role. API keys never leave the server process. */
export type ChatRole = 'system' | 'user' | 'assistant';

/** Single message in a chat completion request. */
export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/** Input shared by all `LlmProvider` implementations. */
export interface ChatCompletionInput {
  messages: ChatMessage[];
  model: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
}

/** Pluggable model backend — swap OpenAI / Groq / Azure / local via factory. */
export interface LlmProvider {
  readonly id: string;
  complete(input: ChatCompletionInput): Promise<string>;
  /** Token stream for chat UIs; must honor input.timeoutMs via AbortSignal. */
  stream(input: ChatCompletionInput): AsyncGenerator<string, void, undefined>;
}
