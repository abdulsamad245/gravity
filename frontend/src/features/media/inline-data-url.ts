/** True when a board field is still an inline data URL (offline / upload fallback). */
export function isInlineDataUrl(value: string | undefined | null): boolean {
  return typeof value === 'string' && value.startsWith('data:');
}

export function mimeFromDataUrl(dataUrl: string): string | undefined {
  const match = /^data:([^;,]+)/i.exec(dataUrl);
  return match?.[1]?.trim().toLowerCase();
}
