/**
 * Embed screenshots into a runbook so the HTML travels on its own.
 *
 *   node scripts/bake-screenshots.mjs runbook.html ./screenshots/jpg
 *
 * Rewrites the `const SHOTS = { ... };` table in place, keyed by the file
 * names used in the plan's `shot:` fields. Only images the plan actually
 * references are embedded, so unused captures cost nothing.
 *
 * Keys map to the ORIGINAL name (foo.png) even when the payload is a JPEG,
 * so the plan does not have to change when you re-encode.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

const [htmlPath, imgDir] = process.argv.slice(2);
if (!htmlPath || !imgDir) {
  console.error('usage: node bake-screenshots.mjs <runbook.html> <image-dir>');
  process.exit(1);
}

const html = readFileSync(htmlPath, 'utf8');

const referenced = [...new Set([...html.matchAll(/shot: '([^']+)'/g)].map((m) => m[1]))].sort();
if (!referenced.length) {
  console.error('no `shot:` references found — nothing to embed');
  process.exit(1);
}

const entries = [];
const missing = [];
for (const name of referenced) {
  // Accept either the original extension or a re-encoded .jpg alongside it.
  const candidates = [name, name.replace(/\.[^.]+$/, '.jpg'), name.replace(/\.[^.]+$/, '.png')];
  const found = candidates.map((c) => join(imgDir, basename(c))).find(existsSync);
  if (!found) { missing.push(name); continue; }
  const mime = found.endsWith('.png') ? 'image/png' : 'image/jpeg';
  const b64 = readFileSync(found).toString('base64');
  entries.push(`  '${name}': 'data:${mime};base64,${b64}'`);
  console.log(`${name.padEnd(34)} ${(readFileSync(found).length / 1024 | 0)}KB`);
}
if (missing.length) {
  console.error('\nmissing images for: ' + missing.join(', '));
  process.exit(1);
}

const start = html.indexOf('const SHOTS = {');
const end = html.indexOf('};', start);
if (start < 0 || end < 0) throw new Error('SHOTS table not found — is this a runbook built from template.html?');

const table = 'const SHOTS = {\n' + entries.join(',\n') + '\n';
const out = html.slice(0, start) + table + html.slice(end);

// Anything left that lives outside this file defeats the point of embedding:
// an asset that will not load, or a sibling document that will not travel.
const assets = [...out.matchAll(/src="(?!data:)([^"]*)"/g)].map((m) => m[1]);
const siblings = [...out.matchAll(/href="(?!data:|#|https?:|mailto:)([^"]*)"/g)].map((m) => m[1]);
const external = [...new Set([...assets, ...siblings])].filter(Boolean);
if (external.length) {
  console.warn('\nwarning: not self-contained — still references: ' + external.join(', '));
}

writeFileSync(htmlPath, out);
console.log(`\nembedded ${entries.length} image(s) -> ${(Buffer.byteLength(out) / 1024 | 0)}KB total`);
