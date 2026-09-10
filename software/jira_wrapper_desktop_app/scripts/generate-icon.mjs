/**
 * Draws build/icon.png from scratch, so the icon is reproducible and the repository
 * carries no binary asset nobody can regenerate. electron-builder derives the Windows
 * .ico from this file.
 *
 *   node scripts/generate-icon.mjs
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SIZE = 512;
const SAMPLES = 4; // supersampling per axis, for smooth edges

const BG_TOP = [0x26, 0x84, 0xff];
const BG_BOTTOM = [0x00, 0x52, 0xcc];
const GLYPH = [0xff, 0xff, 0xff];

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);

/** Rounded-square mask covering the whole canvas. */
function inBackground(x, y) {
  const r = 110;
  const min = 0;
  const max = SIZE;
  const cx = Math.min(Math.max(x, min + r), max - r);
  const cy = Math.min(Math.max(y, min + r), max - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/** A letter J: a vertical stem meeting a hook swept below it. */
function inGlyph(x, y) {
  const stem = x >= 280 && x <= 330 && y >= 130 && y <= 300;
  if (stem) return true;

  const dx = x - 255;
  const dy = y - 300;
  if (dy < 0) return false;
  const d2 = dx * dx + dy * dy;
  return d2 <= 75 * 75 && d2 >= 25 * 25;
}

function coverage(px, py, test) {
  let hits = 0;
  for (let sy = 0; sy < SAMPLES; sy++) {
    for (let sx = 0; sx < SAMPLES; sx++) {
      const x = px + (sx + 0.5) / SAMPLES;
      const y = py + (sy + 0.5) / SAMPLES;
      if (test(x, y)) hits++;
    }
  }
  return hits / (SAMPLES * SAMPLES);
}

function renderRgba() {
  const pixels = Buffer.alloc(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    const t = y / (SIZE - 1);
    const bg = BG_TOP.map((c, i) => Math.round(c + (BG_BOTTOM[i] - c) * t));

    for (let x = 0; x < SIZE; x++) {
      const bgA = coverage(x, y, inBackground);
      const glyphA = coverage(x, y, inGlyph) * bgA;

      const offset = (y * SIZE + x) * 4;
      for (let i = 0; i < 3; i++) {
        // Composite the glyph over the plate, then the plate over transparency.
        pixels[offset + i] = Math.round(bg[i] * (1 - glyphA) + GLYPH[i] * glyphA);
      }
      pixels[offset + 3] = Math.round(clamp01(bgA) * 255);
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

function encodePng(rgba) {
  const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1));
  for (let y = 0; y < SIZE; y++) {
    raw[y * (SIZE * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0);
  ihdr.writeUInt32BE(SIZE, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'build', 'icon.png');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, encodePng(renderRgba()));
console.log(`wrote ${out} (${SIZE}x${SIZE})`);
