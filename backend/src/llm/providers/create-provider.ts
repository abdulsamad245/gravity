import { config } from '../../config/config';
import type { LlmProvider } from '../types';
import { OpenAiCompatibleProvider } from './openai-compatible.provider';

/**
 * Build the configured LLM provider, or `null` when `LLM_API_KEY` is unset.
 * Orbit still answers with fallback copy when this returns null.
 */
export function createLlmProvider(): LlmProvider | null {
  const key = config.LLM_API_KEY?.trim();
  if (!key) return null;

  const baseUrl = config.LLM_BASE_URL;
  switch (config.LLM_PROVIDER) {
    case 'openai':
      return new OpenAiCompatibleProvider(key, baseUrl, 'openai');
    case 'openai_compatible':
    default:
      return new OpenAiCompatibleProvider(key, baseUrl, 'openai_compatible');
  }
}
