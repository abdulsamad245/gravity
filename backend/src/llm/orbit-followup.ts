/** Short confirmations that mean "do what you just offered". */
const SHORT_AFFIRMATION_RE =
  /^(y|ye|yes|yeah|yep|yup|sure|ok|okay|k|please|do\s*it|go\s*ahead|proceed|sounds\s*good|that\s*works|absolutely|affirmative|of\s*course|yes\s*please|ok\s*please)[.!]*$/i;

export function isShortAffirmation(prompt: string): boolean {
  return SHORT_AFFIRMATION_RE.test(prompt.trim());
}

export function extractPendingOffer(assistantText: string): string | null {
  const text = assistantText.replace(/\s+/g, ' ').trim();
  if (!text) return null;
  const offer = text.match(
    /(?:would you like(?: me)? to|shall i|can i|should i|want me to|i can)\s+(.+?)(?:\?|$)/i,
  );
  if (offer?.[1]) {
    return offer[1].replace(/[.!]+$/g, '').trim().slice(0, 280);
  }
  const sentences = text.split(/(?<=[.!?])\s+/);
  const lastQ = [...sentences].reverse().find((s) => s.includes('?'));
  if (lastQ) return lastQ.replace(/\?+$/g, '').trim().slice(0, 280);
  return text.slice(0, 280);
}

/** Expand bare "yes" using prior assistant turns so continuity survives the API boundary. */
export function expandAffirmativeFollowUp(
  prompt: string,
  history: Array<{ role: 'user' | 'assistant'; text: string }>,
): string {
  const q = prompt.trim();
  if (!isShortAffirmation(q)) return q;
  for (let i = history.length - 1; i >= 0; i--) {
    const turn = history[i];
    if (turn.role !== 'assistant') continue;
    const offer = extractPendingOffer(turn.text);
    if (!offer) continue;
    return `Yes, please proceed with what you just offered: ${offer}`;
  }
  return q;
}
