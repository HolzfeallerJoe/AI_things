/**
 * Structural check for a runbook built from template.html.
 *
 *   npm i jsdom      (once, anywhere on the path)
 *   node scripts/verify-runbook.mjs runbook.html
 *
 * Catches the failures that are invisible when you just open the file:
 * duplicate check ids (silently share a tick), a filter combination whose
 * meter disagrees with what is on screen, unresolved screenshots, and a
 * document that renders nothing because boot threw.
 */
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

// jsdom is the one dependency. Bare imports resolve from where this script
// lives, not from where you ran it, so also try the current directory before
// giving up — otherwise `npm i jsdom` in your project looks like it did
// nothing.
async function loadJSDOM() {
  try {
    return (await import('jsdom')).JSDOM;
  } catch { /* not beside the skill or in a parent of it */ }
  try {
    const requireHere = createRequire(pathToFileURL(join(process.cwd(), 'x.js')));
    return requireHere('jsdom').JSDOM;
  } catch { /* not in the current project either */ }
  console.error(
    'verify-runbook needs jsdom, and could not find it.\n\n' +
    'Install it once next to the skill so it works from any project:\n' +
    '  npm i jsdom --prefix ~/.claude/skills/checklist-runbook\n\n' +
    'Or install it in the folder you are running from:\n' +
    '  npm i jsdom'
  );
  process.exit(2);
}

const JSDOM = await loadJSDOM();

const file = process.argv[2];
if (!file) { console.error('usage: node verify-runbook.mjs <runbook.html>'); process.exit(1); }

const html = readFileSync(file, 'utf8');
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://local.test/' });
const d = dom.window.document, w = dom.window;
const vis = (s) => [...d.querySelectorAll(s)].filter((e) => !e.classList.contains('hide'));

let failed = 0;
const check = (ok, label, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? '  — ' + detail : ''}`);
  if (!ok) failed++;
};

// Content rendered at all. If boot throws, everything below is empty.
const sections = d.querySelectorAll('section.sec').length;
const checks = d.querySelectorAll('#main input[type=checkbox]').length;
check(sections > 0 && checks > 0, 'document renders', `${sections} sections, ${checks} checks`);

// Sections must be revealed even without IntersectionObserver.
check(d.querySelectorAll('section.sec.in').length === sections, 'all sections revealed (no blank page)');

// Duplicate ids silently share progress between unrelated checks.
const ids = [...d.querySelectorAll('#main input')].map((i) => i.dataset.id);
const dupes = [...new Set(ids.filter((v, i) => ids.indexOf(v) !== i))];
check(dupes.length === 0, 'check ids unique', dupes.join(', '));

// The meter must always equal what is on screen, in every filter combination.
const paths = [...d.querySelectorAll('.toolbar [data-path]')].map((b) => b.dataset.path);
const plats = [...d.querySelectorAll('.toolbar [data-plat]')].map((b) => b.dataset.plat);
for (const p of paths) {
  for (const pl of plats) {
    d.querySelector(`.toolbar [data-path=${p}]`).click();
    d.querySelector(`.toolbar [data-plat=${pl}]`).click();
    const seen = vis('.item').length;
    const meter = Number(d.getElementById('total-n').textContent);
    check(seen === meter, `meter matches view (${p}/${pl})`, `${seen} visible vs ${meter}`);
  }
}
d.querySelector('.toolbar [data-path=all]')?.click();
d.querySelector('.toolbar [data-plat=all]')?.click();

// Screenshots: embedded ones must resolve, linked ones must exist on disk.
const hints = [...d.querySelectorAll('.hint-btn')];
if (hints.length) {
  const embedded = hints.filter((h) => h.dataset.shot);
  const unresolved = embedded.filter((h) => !w.eval(`typeof SHOTS !== 'undefined' && SHOTS[${JSON.stringify(h.dataset.shot)}]`));
  const linked = hints.filter((h) => h.dataset.ref);
  const broken = linked.filter((h) => !existsSync(join(dirname(file), h.dataset.ref)));
  check(unresolved.length === 0, `screenshots resolve (${hints.length} hints)`, unresolved.map((h) => h.dataset.shot).join(', '));
  check(broken.length === 0, 'linked screenshots exist', broken.map((h) => h.dataset.ref).join(', '));
}

// Progress must survive a reload.
const box = d.querySelector('#main input');
box.checked = true;
box.dispatchEvent(new w.Event('change', { bubbles: true }));
const store = Object.keys(w.localStorage).find((k) => k.includes('runbook'));
check(!!store, 'progress persisted', store);

const seeded = new JSDOM(html.replace('<script>', `<script>localStorage.setItem(${JSON.stringify(store)}, ${JSON.stringify(w.localStorage.getItem(store))});`),
  { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://local.test/' });
check(seeded.window.document.querySelectorAll('#main input:checked').length === 1, 'progress restored after reload');

// Corrupt storage must not take the page down.
const broken = new JSDOM(html.replace('<script>', `<script>localStorage.setItem(${JSON.stringify(store)}, '{not json');`),
  { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://local.test/' });
check(broken.window.document.querySelectorAll('section.sec').length === sections, 'survives corrupt storage');

console.log(failed ? `\n${failed} check(s) failed` : '\nall checks passed');
process.exit(failed ? 1 : 0);
