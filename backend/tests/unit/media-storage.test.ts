import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ApiError } from '../../src/types/api-error';
import { MediaStorageService } from '../../src/services/media-storage.service';

describe('MediaStorageService', () => {
  let dir: string;

  afterEach(async () => {
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it('stores and reads a data URL', async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'gravity-media-'));
    const service = new MediaStorageService(dir);
    const png1x1 =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

    const stored = await service.storeDataUrl(png1x1, 'image/png');
    expect(stored.url).toMatch(/^\/api\/v1\/media\//);
    expect(stored.bytes).toBeGreaterThan(0);

    const read = await service.read(stored.id);
    expect(read?.mimeType).toBe('image/png');
    expect(read?.bytes.byteLength).toBe(stored.bytes);
  });

  it('rejects MIME spoofing when magic bytes disagree', async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'gravity-media-'));
    const service = new MediaStorageService(dir);
    // Declares PNG but payload is plain text.
    const spoofed = `data:image/png;base64,${Buffer.from('not-a-png').toString('base64')}`;

    await expect(service.storeDataUrl(spoofed, 'image/png')).rejects.toBeInstanceOf(ApiError);
  });
});
