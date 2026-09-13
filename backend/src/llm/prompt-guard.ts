/**
 * Lightweight prompt-injection / abuse heuristics for Orbit.
 * Defense in depth alongside a strict system prompt — not a full classifier.
 */

const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
  /disregard\s+(all\s+)?(previous|prior|above)/i,
  /forget\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)/i,
  /override\s+(all\s+)?(previous|prior|system)\s+(instructions?|prompts?|rules?)/i,
  /you\s+are\s+now\s+(?:a|an|in)\b/i,
  /act\s+as\s+(?:if\s+you\s+are\s+)?(?:a|an|my)\b/i,
  /pretend\s+(you\s+are|to\s+be)\b/i,
  /system\s*prompt\s*:/i,
  /<\/?system>/i,
  /USER_MESSAGE_(START|END)/i,
  /CONTEXT_(START|END)/i,
  /\bdo\s+anything\s+now\b/i,
  /\bDAN\b/i,
  /\bjailbreak\b/i,
  /developer\s+mode\b/i,
  /reveal\s+(your|the)\s+(system|hidden)\s+(prompt|instructions?)/i,
  /show\s+(me\s+)?(your|the)\s+(system|hidden)\s+(prompt|instructions?)/i,
  /print\s+(your|the)\s+(system|hidden)\s+(prompt|instructions?)/i,
  /new\s+instructions?\s*:/i,
  /from\s+now\s+on\s+you\s+will\b/i,
  /\brole\s*:\s*system\b/i,
  // Secret / internals fishing (client must not receive these).
  /\b(api[_-]?key|secret[_-]?key|access[_-]?token|bearer\s+token)\b/i,
  /(^|[^A-Za-z0-9_])\.env\b/i,
  /\b(DATA_DIR|OPENAI_API_KEY|LLM_API_KEY|VITE_[A-Z0-9_]+)\b/,
  /\b(system\s+prompt|hidden\s+prompt|internal\s+(config|configuration|architecture))\b/i,
  /\b(docker-compose|nginx\.conf|y-websocket)\b/i,
  /\b(show|print|dump|leak|exfiltrat)\b.{0,40}\b(secret|credential|password|token|prompt)\b/i,
];

/** Patterns that suggest a model reply accidentally leaked internals. */
const REPLY_LEAK_PATTERNS: RegExp[] = [
  /\b(sk-[a-zA-Z0-9]{10,})\b/,
  /\bOPENAI_API_KEY\b/,
  /\bLLM_API_KEY\b/,
  /\bDATA_DIR\b/,
  /\bVITE_[A-Z0-9_]+\s*=/,
  /USER_MESSAGE_(START|END)/,
  /CONTEXT_(START|END)/,
];

/** Strip control chars and hard-cap length before LLM or log use. */
export function sanitizeUserText(input: string, maxChars: number): string {
  const cleaned = input
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length <= maxChars) return cleaned;
  return cleaned.slice(0, maxChars);
}

/**
 * Heuristic injection check only (not a full classifier).
 * When true, Orbit should refuse rather than call the model.
 */
export function looksLikeInjection(text: string): boolean {
  if (!text) return false;
  return INJECTION_PATTERNS.some((re) => re.test(text));
}

/** Scan prompt, history, labels, and attachment names/snippets. */
export function collectInjectionScanText(parts: Array<string | undefined | null>): string {
  return parts.filter(Boolean).join('\n');
}

/**
 * Wrap untrusted user content so the model treats it as data, not instructions.
 */
export function wrapUntrustedUserContent(prompt: string, extras: string): string {
  return [
    'USER_MESSAGE_START',
    prompt || '(empty)',
    'USER_MESSAGE_END',
    extras ? `\nCONTEXT_START\n${extras}\nCONTEXT_END` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** True when an assistant reply looks like it leaked secrets or prompt scaffolding. */
export function looksLikeSecretLeak(reply: string): boolean {
  if (!reply) return false;
  return REPLY_LEAK_PATTERNS.some((re) => re.test(reply));
}

/**
 * Strip accidental secret / scaffolding leaks before the client sees the reply.
 * Returns a safe fallback when the whole message looks compromised.
 */
export function scrubLeakedReply(reply: string, fallback: string): string {
  if (!reply) return fallback;
  if (looksLikeSecretLeak(reply)) {
    let cleaned = reply
      .replace(/\bsk-[a-zA-Z0-9]{10,}\b/g, '[redacted]')
      .replace(/\bOPENAI_API_KEY\b/g, '[redacted]')
      .replace(/\bLLM_API_KEY\b/g, '[redacted]')
      .replace(/\bDATA_DIR\b/g, 'board storage')
      .replace(/\bVITE_[A-Z0-9_]+\s*=\s*\S+/g, '[redacted]')
      .replace(/USER_MESSAGE_(START|END)/g, '')
      .replace(/CONTEXT_(START|END)/g, '')
      .replace(/<!--\s*orbit-gap:[^>]*-->/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!cleaned || looksLikeSecretLeak(cleaned)) return fallback;
    return cleaned;
  }
  return reply;
}
