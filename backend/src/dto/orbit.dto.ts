import type { OrbitOpDto } from '../llm/orbit-ops';

export interface OrbitChatResponseDto {
  reply: string;
  /** Which provider answered ("unavailable" when no API key or the LLM call failed). */
  provider: string;
  model?: string;
  /** Validated board mutations for the client to apply via Yjs. */
  ops?: OrbitOpDto[];
}
