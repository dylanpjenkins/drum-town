// tools/checks/dom-smoke.js
// Structural smoke test over 4 representative built pages. Exit 0 = pass.
// Contract (established by BL-010/BL-011): every page has exactly one <main id="main">,
// a skip link as the first focusable element, and fully labeled notation SVGs.

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const SITE = path.join(__dirname, '..', '..', '_site');
const PAGES = [
  'index.html',
  path.join('lessons', 'paradiddle', 'index.html'),
  path.join('rudiments', 'index.html'),
  path.join('metronome', 'index.html')
];

const failures = [];

for (const rel of PAGES) {
  const p = path.join(SITE, rel);
  if (!fs.existsSync(p)) { failures.push(`${rel}: page missing from _site (run npm run build)`); continue; }
  const dom = new JSDOM(fs.readFileSync(p, 'utf8'));
  const doc = dom.window.document;

  const mains = doc.querySelectorAll('main');
  if (mains.length !== 1) failures.push(`${rel}: expected exactly one <main>, found ${mains.length}`);
  else if (mains[0].id !== 'main') failures.push(`${rel}: <main> must have id="main" (skip-link target)`);

  const firstLink = doc.body.querySelector('a');
  if (!firstLink || !firstLink.classList.contains('skip-link') || firstLink.getAttribute('href') !== '#main') {
    failures.push(`${rel}: first <a> in body must be <a class="skip-link" href="#main">`);
  }

  for (const svg of doc.querySelectorAll('.notation svg')) {
    if (svg.getAttribute('role') !== 'img' || !svg.getAttribute('aria-label')) {
      failures.push(`${rel}: notation svg missing role="img"/aria-label`);
      break; // one report per page is enough
    }
  }
}

if (failures.length) {
  console.error('[dom-smoke] FAIL:');
  failures.forEach(f => console.error('  ' + f));
  process.exit(1);
}
console.log('[dom-smoke] OK — main landmark, skip link, labeled SVGs on all sample pages');
