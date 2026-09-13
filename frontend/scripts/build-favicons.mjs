import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mark = path.join(root, 'public/brand/gravity-mark.png');
const publicDir = path.join(root, 'public');
const brandDir = path.join(root, 'public/brand');

async function makeSquare(size) {
  const padded = Math.round(size * 0.9);
  const buf = await sharp(mark)
    .resize(padded, padded, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .extend({
      top: Math.floor((size - padded) / 2),
      bottom: Math.ceil((size - padded) / 2),
      left: Math.floor((size - padded) / 2),
      right: Math.ceil((size - padded) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  return sharp(buf).resize(size, size).png().toBuffer();
}

function icoFromPngs(pngs, sizes) {
  const count = pngs.length;
  const headerSize = 6 + 16 * count;
  let offset = headerSize;
  const buf = Buffer.alloc(headerSize + pngs.reduce((n, p) => n + p.length, 0));
  buf.writeUInt16LE(0, 0);
  buf.writeUInt16LE(1, 2);
  buf.writeUInt16LE(count, 4);
  let o = 6;
  for (let i = 0; i < count; i++) {
    const size = sizes[i];
    const p = pngs[i];
    buf.writeUInt8(size >= 256 ? 0 : size, o++);
    buf.writeUInt8(size >= 256 ? 0 : size, o++);
    buf.writeUInt8(0, o++);
    buf.writeUInt8(0, o++);
    buf.writeUInt16LE(1, o);
    o += 2;
    buf.writeUInt16LE(32, o);
    o += 2;
    buf.writeUInt32LE(p.length, o);
    o += 4;
    buf.writeUInt32LE(offset, o);
    o += 4;
    offset += p.length;
  }
  let writeAt = headerSize;
  for (const p of pngs) {
    p.copy(buf, writeAt);
    writeAt += p.length;
  }
  return buf;
}

const png32 = await makeSquare(32);
const png48 = await makeSquare(48);
const png180 = await makeSquare(180);
const png512 = await makeSquare(512);

/** PWA icons: solid canvas bg + padded mark (maskable needs extra safe zone). */
async function makePwaIcon(size, padRatio) {
  const pad = Math.round(size * padRatio);
  const inner = size - pad * 2;
  const icon = await sharp(mark)
    .resize(inner, inner, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 18, g: 20, b: 26, alpha: 1 } },
  })
    .composite([{ input: icon, left: pad, top: pad }])
    .png()
    .toBuffer();
}

const pwa192 = await makePwaIcon(192, 0.12);
const pwa512 = await makePwaIcon(512, 0.12);
const pwa192Mask = await makePwaIcon(192, 0.18);
const pwa512Mask = await makePwaIcon(512, 0.18);

fs.writeFileSync(path.join(brandDir, 'favicon-32.png'), png32);
fs.writeFileSync(path.join(brandDir, 'favicon-48.png'), png48);
fs.writeFileSync(path.join(brandDir, 'apple-touch-icon.png'), png180);
fs.writeFileSync(path.join(brandDir, 'gravity-mark-512.png'), png512);

fs.writeFileSync(path.join(publicDir, 'favicon-32.png'), png32);
fs.writeFileSync(path.join(publicDir, 'favicon-48.png'), png48);
fs.writeFileSync(path.join(publicDir, 'favicon.png'), png32);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), png180);
fs.writeFileSync(path.join(publicDir, 'favicon.ico'), icoFromPngs([png32, png48], [32, 48]));
fs.writeFileSync(path.join(publicDir, 'pwa-192.png'), pwa192);
fs.writeFileSync(path.join(publicDir, 'pwa-512.png'), pwa512);
fs.writeFileSync(path.join(publicDir, 'pwa-192-maskable.png'), pwa192Mask);
fs.writeFileSync(path.join(publicDir, 'pwa-512-maskable.png'), pwa512Mask);

const b64 = png32.toString('base64');
fs.writeFileSync(
  path.join(publicDir, 'favicon.svg'),
  `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <image width="32" height="32" href="data:image/png;base64,${b64}"/>
</svg>
`,
);

console.log(
  'Wrote favicon.ico / favicon.svg / favicon-32.png / pwa-*.png from gravity-mark.png',
);
