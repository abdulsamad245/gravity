import type { Browser, Page } from '@playwright/test';
import fs from 'fs';

/** Dismiss first-run / share modals and the product tour that block the canvas. */
async function dismissOverlays(page: Page): Promise<void> {
  for (let i = 0; i < 4; i++) {
    const backdrop = page.locator('.modal-backdrop');
    if (!(await backdrop.count())) break;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(250);
    const close = page.getByRole('button', { name: /^close$/i }).first();
    if (await close.count()) await close.click({ force: true }).catch(() => {});
  }
  await page.locator('.modal-backdrop').waitFor({ state: 'hidden', timeout: 4000 }).catch(() => {});

  // Tour can start after the empty-board modal; wait briefly then Skip.
  const skipTour = page.getByRole('button', { name: /skip tour|^skip$/i }).first();
  await skipTour.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  if (await skipTour.count()) {
    await skipTour.click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
  }
  await page.locator('.driver-overlay').waitFor({ state: 'hidden', timeout: 4000 }).catch(() => {});
  await page.locator('.driver-popover').waitFor({ state: 'hidden', timeout: 2000 }).catch(() => {});
}

/** Enters the app as a named guest and creates a fresh room. Returns its URL. */
export async function createRoom(page: Page, name: string): Promise<string> {
  await page.goto('/');
  await page.fill('#username', name);
  const create = page.getByRole('button', { name: /open a blank room|create a room/i });
  await create.click();
  await page.waitForURL(/\/rooms\//);
  await page.waitForTimeout(800);
  await dismissOverlays(page);
  return page.url();
}

/** Joins an existing room in a fresh browser context as a named guest. */
export async function joinRoom(browser: Browser, roomUrl: string, name: string): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(roomUrl);
  await page.fill('input', name);
  await page.click('text=Jump in');
  await page.waitForTimeout(1000);
  await dismissOverlays(page);
  return page;
}

/**
 * Selects a tool. Direct tools (Select, Sticky, Text) are one click;
 * nested tools open their category flyout first.
 */
export async function pickTool(page: Page, label: string): Promise<void> {
  /** Primary-rail flyouts (category label → open, then pick item). */
  const nested: Record<string, string> = {
    Pen: 'Draw',
    Highlighter: 'Draw',
    Eraser: 'Draw',
    Laser: 'Draw',
    Stamp: 'Draw',
    Line: 'Shapes',
    Rectangle: 'Shapes',
    Oval: 'Shapes',
    Table: 'Shapes',
    Straight: 'Connect',
    'Right angle': 'Connect',
    Curved: 'Connect',
    Polyline: 'Connect',
    Connector: 'Connect',
    Rope: 'Physics',
    Attract: 'Physics',
    Repel: 'Physics',
    Wind: 'Physics',
    'Topic magnet': 'Physics',
    'Archive well': 'Physics',
  };
  /** Overflow under ··· More tools. */
  const moreTools = new Set(['Web embed', 'Charts', 'Other resources']);
  /** Primary-rail actions that are not tool categories. */
  const primaryActions: Record<string, string> = {
    'Voice note': 'Record voice note',
  };
  const toolbarBtn = (name: string) =>
    page.locator(`.toolbar button[aria-label="${name}"], .toolbar button[title^="${name}"]`).first();

  const category = nested[label];
  if (category) {
    await toolbarBtn(category).click();
    const itemLabel = label === 'Connector' ? 'Straight' : label;
    await page.click(`.tool-flyout-item:has-text("${itemLabel}")`);
    return;
  }
  if (moreTools.has(label)) {
    await toolbarBtn('More tools').click();
    await page.click(`.tool-flyout-item:has-text("${label}")`);
    return;
  }
  await toolbarBtn(primaryActions[label] ?? label).click();
}

/** Enable physics on the currently selected object. */
export async function enablePhysics(page: Page): Promise<void> {
  const off = page.getByRole('button', { name: /^physics off$/i });
  if (await off.count()) {
    await off.click();
    return;
  }
  // Legacy label from older builds
  await page.click('text=Physics OFF').catch(() => {});
}

/** Reads canvas state through the app's own JSON export (ground truth). */
export async function exportState(page: Page): Promise<{ objects: Array<Record<string, any>> }> {
  await page.click('button[aria-label="More actions"]');
  const exportItem = page
    .getByRole('menuitem', { name: /download json|export json/i })
    .or(page.getByRole('button', { name: /download json|export json|json data|^json$/i }));
  const [download] = await Promise.all([page.waitForEvent('download'), exportItem.first().click()]);
  return JSON.parse(fs.readFileSync((await download.path())!, 'utf8'));
}

/** Human-speed drag (velocity must be measurable for throws). */
export async function drag(page: Page, from: [number, number], to: [number, number], steps = 10) {
  await page.mouse.move(...from);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(
      from[0] + ((to[0] - from[0]) * i) / steps,
      from[1] + ((to[1] - from[1]) * i) / steps,
    );
    await page.waitForTimeout(10);
  }
  await page.mouse.up();
}
