export function insertIntoTextarea(
  el: HTMLTextAreaElement,
  text: string,
  maxLength?: number,
): string {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  let next = el.value.slice(0, start) + text + el.value.slice(end);
  if (typeof maxLength === 'number' && next.length > maxLength) {
    next = next.slice(0, maxLength);
  }
  el.value = next;
  const caret = Math.min(start + text.length, next.length);
  el.setSelectionRange(caret, caret);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return next;
}
