import { describe, expect, it } from 'vitest';
import {
  isOrbitVideoFile,
  ORBIT_MAX_ATTACHMENTS,
  ORBIT_MAX_FILE_BYTES,
  ORBIT_MAX_TOTAL_EXTRACT_CHARS,
} from '../../shared/constants/media.constants';
import { formatOrbitBytes, isOrbitFileAllowed, prepareOrbitAttachments } from './orbit-attachments';

function fakeFile(name: string, type: string, size: number, contents?: string): File {
  if (contents != null) {
    return new File([contents], name, { type });
  }
  const buf = new Uint8Array(Math.min(size, 32));
  // PNG magic when claiming png so security sniff passes for small tests.
  if (type === 'image/png') {
    buf.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  }
  return new File([buf], name, { type });
}

describe('Orbit attachment rules', () => {
  it('blocks video MIME and common video extensions', () => {
    expect(isOrbitVideoFile('video/mp4', 'clip.mp4')).toBe(true);
    expect(isOrbitVideoFile('', 'clip.mov')).toBe(true);
    expect(isOrbitVideoFile('video/webm', 'clip.webm')).toBe(true);
    expect(isOrbitFileAllowed(fakeFile('clip.mp4', 'video/mp4', 1000))).toBe(false);
  });

  it('allows mic voice notes (audio/webm) but not bare video webm', () => {
    expect(isOrbitVideoFile('audio/webm', 'Voice note.webm')).toBe(false);
    expect(isOrbitFileAllowed(fakeFile('note.webm', 'audio/webm', 1000))).toBe(true);
    expect(isOrbitFileAllowed(fakeFile('clip.webm', '', 1000))).toBe(false);
  });

  it('rejects oversized files with a clear message', async () => {
    const big = fakeFile('huge.png', 'image/png', ORBIT_MAX_FILE_BYTES + 10);
    Object.defineProperty(big, 'size', { value: ORBIT_MAX_FILE_BYTES + 10 });
    const { ok, errors } = await prepareOrbitAttachments([big], 0);
    expect(ok).toHaveLength(0);
    expect(errors[0]?.code).toBe('too_large');
    expect(errors[0]?.message).toMatch(formatOrbitBytes(ORBIT_MAX_FILE_BYTES));
  });

  it('rejects video uploads in prepareOrbitAttachments', async () => {
    const vid = fakeFile('demo.mp4', 'video/mp4', 500);
    const { ok, errors } = await prepareOrbitAttachments([vid], 0);
    expect(ok).toHaveLength(0);
    expect(errors[0]?.message).toMatch(/video/i);
  });

  it('rejects adding more than ORBIT_MAX_ATTACHMENTS', async () => {
    const { ok, errors } = await prepareOrbitAttachments(
      [fakeFile('extra.txt', 'text/plain', 12, 'hello world')],
      ORBIT_MAX_ATTACHMENTS,
    );
    expect(ok).toHaveLength(0);
    expect(errors[0]?.code).toBe('too_many');
  });

  it('trims extracted text to the remaining total budget', async () => {
    const already = ORBIT_MAX_TOTAL_EXTRACT_CHARS - 20;
    const { ok, errors } = await prepareOrbitAttachments(
      [fakeFile('notes.txt', 'text/plain', 100, 'x'.repeat(80))],
      0,
      already,
    );
    expect(errors).toHaveLength(0);
    expect(ok[0]?.extractedText).toHaveLength(20);
  });
});
