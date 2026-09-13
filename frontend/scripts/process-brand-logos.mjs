/**
 * Builds transparent brand assets into public/brand/.
 * Usage (from frontend/):
 *   npm run brand:process -- path/to/lockup.png path/to/mark.png
 * Overwrites gravity-lockup*.png, gravity-mark*.png, and favicon sizes in place.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const brandDir = path.join(root, 'public', 'brand');
const publicDir = path.join(root, 'public');

function resolveSrc(arg, label) {
  if (!arg) {
    throw new Error(
      `Missing ${label}. Usage: npm run brand:process -- <lockup.png> <mark.png>`,
    );
  }
  const resolved = path.resolve(process.cwd(), arg);
  if (!fs.existsSync(resolved)) throw new Error(`Missing ${label}: ${resolved}`);
  return resolved;
}

function isNearBlack(r, g, b, a) {
  if (a < 8) return true;
  return r < 48 && g < 48 && b < 55 && Math.max(r, g, b) - Math.min(r, g, b) < 28;
}

function isNearWhite(r, g, b) {
  return r > 210 && g > 210 && b > 210;
}

/** Flood-fill near-black from edges → alpha 0 (keeps dark sparkle on the planet). */
function knockOutBackground(rgba, width, height) {
  const visited = new Uint8Array(width * height);
  const stack = [];

  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = y * width + x;
    if (visited[i]) return;
    const o = i * 4;
    if (!isNearBlack(rgba[o], rgba[o + 1], rgba[o + 2], rgba[o + 3])) return;
    visited[i] = 1;
    stack.push(i);
  };

  for (let x = 0; x < width; x++) {
    push(x, 0);
    push(x, height - 1);
  }
  for (let y = 0; y < height; y++) {
    push(0, y);
    push(width - 1, y);
  }

  while (stack.length) {
    const i = stack.pop();
    const o = i * 4;
    rgba[o + 3] = 0;
    const x = i % width;
    const y = (i / width) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
}

/** First column that contains wordmark ink (near-white), after the planet mark. */
function findWordmarkStart(rgba, width, height) {
  for (let x = 0; x < width; x++) {
    let white = 0;
    for (let y = 0; y < height; y++) {
      const o = (y * width + x) * 4;
      if (rgba[o + 3] > 20 && isNearWhite(rgba[o], rgba[o + 1], rgba[o + 2])) white++;
    }
    if (white > height * 0.05) return Math.max(0, x - 4);
  }
  return Math.floor(width * 0.35);
}

/**
 * Light UI lockup: white glyphs → dark ink, and punch out baked-in black
 * letter counters (e.g. the hole in “a”) so they stay open on pale chrome.
 * Only touches the wordmark region — planet rings/sparkles stay intact.
 */
function makeLightWordmark(rgba, width, height) {
  const wmStart = findWordmarkStart(rgba, width, height);
  for (let y = 0; y < height; y++) {
    for (let x = wmStart; x < width; x++) {
      const o = (y * width + x) * 4;
      if (rgba[o + 3] < 8) continue;
      const r = rgba[o];
      const g = rgba[o + 1];
      const b = rgba[o + 2];
      if (isNearBlack(r, g, b, 255)) {
        rgba[o + 3] = 0;
        continue;
      }
      if (isNearWhite(r, g, b)) {
        rgba[o] = 18;
        rgba[o + 1] = 20;
        rgba[o + 2] = 26;
      }
    }
  }
}

async function loadRgba(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { rgba: new Uint8Array(data), width: info.width, height: info.height };
}

async function writePng(rgba, width, height, out) {
  await sharp(Buffer.from(rgba), { raw: { width, height, channels: 4 } })
    .png()
    .toFile(out);
}

async function trimTransparent(inputPath, outputPath, pad = 8) {
  await sharp(inputPath)
    .trim({ threshold: 4 })
    .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outputPath);
}

async function resizeSquare(input, size, output) {
  await sharp(input)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(output);
}

async function processOne(src, { outDir, base, makeLightLockup = false }) {
  const { rgba, width, height } = await loadRgba(src);
  knockOutBackground(rgba, width, height);
  const rawOut = path.join(outDir, `${base}-raw.png`);
  await writePng(rgba, width, height, rawOut);
  const clearOut = path.join(outDir, `${base}.png`);
  await trimTransparent(rawOut, clearOut, 6);
  fs.unlinkSync(rawOut);

  if (makeLightLockup) {
    const again = await loadRgba(clearOut);
    makeLightWordmark(again.rgba, again.width, again.height);
    const lightRaw = path.join(outDir, `${base}-light-raw.png`);
    await writePng(again.rgba, again.width, again.height, lightRaw);
    await trimTransparent(lightRaw, path.join(outDir, `${base}-light.png`), 6);
    fs.unlinkSync(lightRaw);
  }

  return clearOut;
}

async function main() {
  const [, , lockupArg, markArg] = process.argv;
  const srcLockup = resolveSrc(lockupArg, 'lockup PNG');
  const srcMark = resolveSrc(markArg, 'mark PNG');

  fs.mkdirSync(brandDir, { recursive: true });

  console.log('Processing mark…');
  const mark = await processOne(srcMark, { outDir: brandDir, base: 'gravity-mark' });

  console.log('Processing lockup…');
  await processOne(srcLockup, { outDir: brandDir, base: 'gravity-lockup', makeLightLockup: true });

  await resizeSquare(mark, 32, path.join(brandDir, 'favicon-32.png'));
  await resizeSquare(mark, 48, path.join(brandDir, 'favicon-48.png'));
  await resizeSquare(mark, 180, path.join(brandDir, 'apple-touch-icon.png'));
  await resizeSquare(mark, 512, path.join(brandDir, 'gravity-mark-512.png'));

  fs.copyFileSync(path.join(brandDir, 'favicon-32.png'), path.join(publicDir, 'favicon-32.png'));
  fs.copyFileSync(path.join(brandDir, 'apple-touch-icon.png'), path.join(publicDir, 'apple-touch-icon.png'));
  fs.copyFileSync(mark, path.join(publicDir, 'logo.png'));

  console.log('Done → public/brand/. Optional: npm run brand:favicons');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
