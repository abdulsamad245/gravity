import { expect, test } from '@playwright/test';
import fs from 'fs';
import { createRoom, drag, enablePhysics, exportState, joinRoom, pickTool } from './helpers';

test.describe('real-time collaboration', () => {
  test('two users share a room: objects, presence and cursors sync live', async ({ page, browser }) => {
    const roomUrl = await createRoom(page, 'Ada');

    await pickTool(page, 'Sticky note');
    await page.mouse.click(640, 400);
    await page.keyboard.type('hello from Ada');
    await page.keyboard.press('Escape');

    await pickTool(page, 'Pen');
    await drag(page, [400, 300], [700, 350]);

    const grace = await joinRoom(browser, roomUrl, 'Grace');

    const state = await exportState(grace);
    expect(state.objects.some((o) => o.text === 'hello from Ada')).toBe(true);
    expect(state.objects.some((o) => o.type === 'path')).toBe(true);

    await expect(page.locator('.avatar')).toHaveCount(2);

    await grace.mouse.move(600, 400);
    await page.waitForTimeout(800);
    await grace.close();
  });

  test('edits made while offline merge after reconnecting', async ({ page, browser, context }) => {
    const roomUrl = await createRoom(page, 'Ada');
    const grace = await joinRoom(browser, roomUrl, 'Grace');

    await context.setOffline(true);
    await page.evaluate(() => (window as any).__gravityProvider?.ws?.close());
    await page.waitForTimeout(1000);
    await expect(page.locator('.status-dot.status-offline')).toBeVisible();

    await pickTool(page, 'Sticky note');
    await page.mouse.click(800, 300);
    await page.keyboard.type('written offline');
    await page.keyboard.press('Escape');

    await context.setOffline(false);
    await page.waitForTimeout(3500);

    const state = await exportState(grace);
    expect(state.objects.some((o) => o.text === 'written offline')).toBe(true);
    await grace.close();
  });

  test('code blocks edit collaboratively with language metadata', async ({ page, browser }) => {
    const roomUrl = await createRoom(page, 'Ada');
    const grace = await joinRoom(browser, roomUrl, 'Grace');

    await pickTool(page, 'Code block');
    await page.mouse.click(640, 400);
    await expect(page.locator('.code-edit-shell')).toBeVisible();
    await page.locator('.cm-content').click();
    await page.keyboard.press('Control+A');
    await page.keyboard.type('const shared: boolean = true;');
    await page.getByLabel('Code language').click();
    await page.getByRole('option', { name: 'Python' }).click();
    await page.getByRole('button', { name: 'Done' }).click();
    await page.waitForTimeout(500);

    const state = await exportState(grace);
    const code = state.objects.find((object) => object.type === 'code');
    expect(code?.text).toBe('const shared: boolean = true;');
    expect(code?.language).toBe('python');
    await grace.close();
  });
});

test.describe('physics', () => {
  test('a thrown object glides beyond its release point and slows down', async ({ page }) => {
    await createRoom(page, 'Thrower');

    await pickTool(page, 'Rectangle');
    await page.mouse.click(400, 400);
    await enablePhysics(page);

    await drag(page, [400, 400], [650, 400]);
    await page.waitForTimeout(1200);

    const state = await exportState(page);
    const rect = state.objects.find((o) => o.type === 'rect')!;
    expect(rect.x).toBeGreaterThan(650);
  });

  test('the attract tool pulls physics objects toward the pointer', async ({ page }) => {
    await createRoom(page, 'Magneto');

    await pickTool(page, 'Rectangle');
    await page.mouse.click(700, 400);
    await enablePhysics(page);

    const before = (await exportState(page)).objects.find((o) => o.type === 'rect')!.x;

    await pickTool(page, 'Attract');
    await page.mouse.move(300, 400);
    await page.mouse.down();
    await page.waitForTimeout(1500);
    await page.mouse.up();
    await pickTool(page, 'Select');

    const after = (await exportState(page)).objects.find((o) => o.type === 'rect')!.x;
    expect(after).toBeLessThan(before - 30);
  });
});

test.describe('media and export', () => {
  test('uploaded images and recorded voice notes become canvas objects', async ({ page }) => {
    await createRoom(page, 'Media');

    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJADveWkH6oAAAAAElFTkSuQmCC',
      'base64',
    );
    await page.setInputFiles('input[type="file"][accept="image/*"]', {
      name: 't.png',
      mimeType: 'image/png',
      buffer: png,
    });
    await page.waitForTimeout(600);

    // Clear any notice dialog (e.g. mic blocked on a previous attempt).
    const notice = page.locator('.dialog-backdrop');
    if (await notice.isVisible().catch(() => false)) {
      await page.getByRole('button', { name: /^ok$/i }).click();
      await notice.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
    }

    await page.locator('button[aria-label="Record voice note"]').click();
    await expect(page.locator('.voice-record-beside-mic button[aria-label="Stop recording"]')).toBeVisible({
      timeout: 5000,
    });
    await page.waitForTimeout(1200);
    await page.locator('.voice-record-beside-mic button[aria-label="Stop recording"]').click();
    await page.waitForTimeout(900);

    const state = await exportState(page);
    expect(state.objects.some((o) => o.type === 'image' && o.src?.startsWith('data:image'))).toBe(true);
    expect(state.objects.some((o) => o.type === 'audio' && o.audio?.startsWith('data:'))).toBe(true);
  });
});

test.describe('time travel', () => {
  test('replay rebuilds the session from the beginning', async ({ page }) => {
    await createRoom(page, 'Historian');

    await pickTool(page, 'Sticky note');
    await page.mouse.click(500, 400);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);

    await page.click('button[aria-label="Watch how this board was built, step by step"]');
    await expect(page.locator('.replay-bar')).toBeVisible();

    await page.getByRole('button', { name: 'Export' }).click();
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('menuitem', { name: 'Save session history' }).click(),
    ]);
    const replayFile = JSON.parse(fs.readFileSync((await download.path())!, 'utf8'));
    expect(replayFile.kind).toBe('session-replay');
    expect(replayFile.entries.length).toBeGreaterThan(0);

    // Dismiss the plain-language “what you saved” dialog.
    await page.getByRole('button', { name: 'OK' }).click();

    await page.locator('.replay-bar input[type="range"]').fill('0');
    await page.locator('.replay-bar button').first().click();
    await page.waitForTimeout(2500);

    await page.click('text=Exit');
    await expect(page.locator('.replay-bar')).toHaveCount(0);
  });
});
