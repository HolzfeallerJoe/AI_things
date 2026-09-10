/**
 * Draws the application icons from scratch, so the repository carries no binary asset
 * nobody can regenerate. Node is needed only for this - the app itself has no
 * JavaScript toolchain at all.
 *
 * The mark is three board columns of descending height: it reads as a board rather
 * than as a letter, and still holds together at 16px in the taskbar.
 *
 *   node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SAMPLES = 4; // supersampling per axis, for smooth edges
const REFERENCE = 512; // the geometry below is expressed at this size

const BG_TOP = [0x5c, 0x97, 0xff];
const BG_BOTTOM = [0x1e, 0x40, 0xaf];
const CARD = [0xff, 0xff, 0xff];

const PLATE_RADIUS = 112;

// Three columns, fewer cards as work moves right.
const COLUMN_X = [108, 218, 328];
const COLUMN_CARDS = [3, 2, 1];
const COLUMN_ALPHA = [1.0, 0.88, 0.72];

const CARD_W = 76;
const CARD_H = 56;
const CARD_GAP = 22;
const CARD_RADIUS = 15;
const TOP = 150;

/** Signed containment test for a rounded rectangle. */
function inRoundedRect(x, y, rx, ry, w, h, radius) {
  if (x < rx || y < ry || x > rx + w || y > ry + h) return false;
  const cx = Math.min(Math.max(x, rx + radius), rx + w - radius);
  const cy = Math.min(Math.max(y, ry + radius), ry + h - radius);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius;
}

function inPlate(x, y, size) {
  const s = size / REFERENCE;
  return inRoundedRect(x, y, 0, 0, size, size, PLATE_RADIUS * s);
}

/** Returns the card opacity at this point, or 0 where there is no card. */
function cardAlphaAt(x, y, size) {
  const s = size / REFERENCE;
  for (let column = 0; column < COLUMN_X.length; column++) {
    const left = COLUMN_X[column] * s;
    for (let index = 0; index < COLUMN_CARDS[column]; index++) {
      const top = (TOP + index * (CARD_H + CARD_GAP)) * s;
      if (inRoundedRect(x, y, left, top, CARD_W * s, CARD_H * s, CARD_RADIUS * s)) {
        return COLUMN_ALPHA[column];
      }
    }
  }
  return 0;
}

/** Averages a 0..1 sampler over a pixel, which is what smooths the edges. */
function sample(px, py, size, valueAt) {
  let total = 0;
  for (let sy = 0; sy < SAMPLES; sy++) {
    for (let sx = 0; sx < SAMPLES; sx++) {
      total += valueAt(px + (sx + 0.5) / SAMPLES, py + (sy + 0.5) / SAMPLES, size);
    }
  }
  return total / (SAMPLES * SAMPLES);
}

function renderRgba(size) {
  const pixels = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    const t = y / (size - 1);
    const background = BG_TOP.map((c, i) => Math.round(c + (BG_BOTTOM[i] - c) * t));

    for (let x = 0; x < size; x++) {
      const plate = sample(x, y, size, (sx, sy, s) => (inPlate(sx, sy, s) ? 1 : 0));
      const cards = sample(x, y, size, cardAlphaAt) * plate;

      const offset = (y * size + x) * 4;
      for (let i = 0; i < 3; i++) {
        pixels[offset + i] = Math.round(background[i] * (1 - cards) + CARD[i] * cards);
      }
      pixels[offset + 3] = Math.round(plate * 255);
    }
  }
  return pixels;
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(rgba, size) {
  const stride = size * 4 + 1;
  const raw = Buffer.alloc(size * stride);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0; // filter: none
    rgba.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** ICO container holding one PNG per size (supported since Windows Vista). */
function encodeIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(entries.length, 4);

  const directory = Buffer.alloc(16 * entries.length);
  let offset = header.length + directory.length;

  entries.forEach(({ size, png }, index) => {
    const at = index * 16;
    directory[at] = size >= 256 ? 0 : size; // 0 means 256
    directory[at + 1] = size >= 256 ? 0 : size;
    directory[at + 2] = 0; // palette entries
    directory[at + 3] = 0; // reserved
    directory.writeUInt16LE(1, at + 4); // colour planes
    directory.writeUInt16LE(32, at + 6); // bits per pixel
    directory.writeUInt32LE(png.length, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });

  return Buffer.concat([header, directory, ...entries.map((e) => e.png)]);
}

const iconsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'icons');
mkdirSync(iconsDir, { recursive: true });

const cache = new Map();
const pngFor = (size) => {
  if (!cache.has(size)) cache.set(size, encodePng(renderRgba(size), size));
  return cache.get(size);
};

const named = [
  ['32x32.png', 32],
  ['128x128.png', 128],
  ['128x128@2x.png', 256],
  ['icon.png', 512],
];

for (const [name, size] of named) {
  writeFileSync(join(iconsDir, name), pngFor(size));
  console.log(`${name} (${size}x${size})`);
}

const icoSizes = [16, 32, 48, 64, 128, 256];
writeFileSync(
  join(iconsDir, 'icon.ico'),
  encodeIco(icoSizes.map((size) => ({ size, png: pngFor(size) }))),
);
console.log(`icon.ico (${icoSizes.join(', ')})`);
