import { expect, test } from '@playwright/test';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRoom } from './helpers';

/** Mirrors frontend/src/shared/constants/orbit.constants.ts + media.constants.ts */
const ORBIT_MAX_PROMPT_CHARS = 2_000;
const ORBIT_MAX_ATTACHMENTS = 4;
const ORBIT_MAX_FILE_BYTES = 1 * 1024 * 1024;

async function openOrbit(page: import('@playwright/test').Page): Promise<void> {
  // Empty boards show the start modal — close it so the room chrome is free.
  const closeStart = page.getByRole('button', { name: /^close$/i }).first();
  if (await closeStart.count()) {
    await closeStart.click().catch(() => {});
    await page.waitForTimeout(300);
  }
  await page.getByRole('button', { name: /^orbit$/i }).first().click();
  await expect(page.getByLabel('Orbit assistant')).toBeVisible();
}

function writeTempFile(name: string, bytes: number, header?: number[]): string {
  const filePath = path.join(os.tmpdir(), `gravity-orbit-${Date.now()}-${name}`);
  const buf = Buffer.alloc(bytes, 0x61);
  if (header?.length) header.forEach((b, i) => {
    buf[i] = b;
  });
  fs.writeFileSync(filePath, buf);
  return filePath;
}

test.describe('Orbit message and upload limits', () => {
  test('composer enforces the LLM prompt character cap', async ({ page }) => {
    await createRoom(page, 'LimitTester');
    await openOrbit(page);

    const composer = page.getByLabel('Orbit message');
    await expect(composer).toBeVisible();
    await expect(composer).toHaveAttribute('maxlength', String(ORBIT_MAX_PROMPT_CHARS));

    const oversized = 'x'.repeat(ORBIT_MAX_PROMPT_CHARS + 250);
    // Drive React's onChange (native fill can bypass maxLength in some engines).
    await composer.evaluate((el, value) => {
      const proto = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value');
      proto?.set?.call(el, value);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, oversized);
    await expect(composer).toHaveValue('x'.repeat(ORBIT_MAX_PROMPT_CHARS));

    await expect(page.getByRole('alert')).toContainText(/limited to 2,000 characters/i);
  });

  test('rejects oversized file uploads in the Orbit composer', async ({ page }) => {
    await createRoom(page, 'UploadTester');
    await openOrbit(page);

    const tooBig = writeTempFile('huge.png', ORBIT_MAX_FILE_BYTES + 2048, [
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ]);
    try {
      await page.locator('aside[aria-label="Orbit assistant"] input[type="file"]').setInputFiles(tooBig);
      await expect(page.getByRole('alert')).toContainText(/too large/i);
      await expect(page.locator('.sidekick-attach-pill')).toHaveCount(0);
    } finally {
      fs.unlinkSync(tooBig);
    }
  });

  test('rejects a fifth attachment beyond the max count', async ({ page }) => {
    await createRoom(page, 'AttachCap');
    await openOrbit(page);

    const files = Array.from({ length: ORBIT_MAX_ATTACHMENTS + 1 }, (_, i) =>
      writeTempFile(`note-${i}.txt`, 32),
    );
    try {
      const input = page.locator('aside[aria-label="Orbit assistant"] input[type="file"]');
      await input.setInputFiles(files.slice(0, ORBIT_MAX_ATTACHMENTS));
      await expect(page.locator('.sidekick-attach-pill')).toHaveCount(ORBIT_MAX_ATTACHMENTS);

      await input.setInputFiles(files[ORBIT_MAX_ATTACHMENTS]!);
      await expect(page.getByRole('alert')).toContainText(/up to 4 files/i);
      await expect(page.locator('.sidekick-attach-pill')).toHaveCount(ORBIT_MAX_ATTACHMENTS);
    } finally {
      for (const f of files) fs.unlinkSync(f);
    }
  });

  test('rejects video uploads in Orbit chat', async ({ page }) => {
    await createRoom(page, 'NoVideo');
    await openOrbit(page);

    const video = writeTempFile('clip.mp4', 512);
    try {
      await page.locator('aside[aria-label="Orbit assistant"] input[type="file"]').setInputFiles(video);
      await expect(page.getByRole('alert')).toContainText(/video/i);
      await expect(page.locator('.sidekick-attach-pill')).toHaveCount(0);
    } finally {
      fs.unlinkSync(video);
    }
  });
});
