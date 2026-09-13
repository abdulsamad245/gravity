/**
 * Human-readable Orbit selection notes.
 * Users can type the same plain phrases in any prompt; selection is optional.
 */

export type OrbitContextRef = {
  type: string;
  label: string;
};

/** Friendly type name for chat + prompts (lowercase, everyday words). */
export function prettyOrbitType(type: string): string {
  switch (type) {
    case 'rect':
      return 'rectangle';
    case 'ellipse':
      return 'oval';
    case 'sticky':
      return 'sticky';
    case 'text':
      return 'text';
    case 'frame':
      return 'frame';
    case 'image':
      return 'image';
    case 'code':
      return 'code block';
    case 'connector':
      return 'connector';
    case 'pen':
      return 'drawing';
    case 'table':
      return 'table';
    case 'embed':
      return 'embed';
    case 'comment':
      return 'comment';
    default:
      return type.replace(/[-_]+/g, ' ').trim() || 'item';
  }
}

function formatOneRef(item: OrbitContextRef): string {
  const kind = prettyOrbitType(item.type);
  const label = item.label.trim().replace(/\s+/g, ' ');
  if (!label) return `the ${kind}`;
  // Empty/default objects often reuse the type as the label ("Text", "Sticky").
  if (label.toLowerCase() === kind || label.toLowerCase() === item.type.toLowerCase()) {
    return `the ${kind}`;
  }
  return `${kind} "${label}"`;
}

/**
 * Short note appended under a user prompt when canvas selection is included.
 */
export function formatOrbitSelectionNote(items: OrbitContextRef[]): string {
  if (!items.length) return '';
  const parts = items.map(formatOneRef);
  if (parts.length === 1) return `Using: ${parts[0]}`;
  return `Using (${parts.length}): ${parts.join('; ')}`;
}

/** Match legacy "Canvas context…" and current "Using…" appendix. */
const CONTEXT_APPENDIX =
  /\n\n(?:Canvas context(?:\s*\(\d+\))?\s*:|Using(?:\s*\(\d+\))?\s*:)\s*[\s\S]*$/i;

export function stripOrbitContextAppendix(text: string): string {
  return text.replace(CONTEXT_APPENDIX, '').trimEnd();
}

export function splitOrbitUserText(text: string): { body: string; using: string | null } {
  const match = text.match(
    /^(.*?)\n\n(?:Canvas context(?:\s*\(\d+\))?\s*:|Using(?:\s*\(\d+\))?\s*:)\s*([\s\S]*)$/is,
  );
  if (!match) return { body: text, using: null };
  const body = (match[1] ?? '').trimEnd();
  const raw = (match[2] ?? '').trim();
  if (!raw) return { body, using: null };
  if (/^Using\b/i.test(raw)) return { body, using: raw };
  return { body, using: `Using: ${raw}` };
}
