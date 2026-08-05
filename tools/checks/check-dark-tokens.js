// tools/checks/check-dark-tokens.js
// The dark theme ships as the SAME token slots re-declared in two places: the
// system-preference default and the explicit [data-theme="dark"] override.
// They must stay byte-identical or the toggle and the OS preference drift
// apart. This gate compares the two fenced bodies and checks slot parity with
// :root. Exit 0 = pass.

const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, '..', '..', 'src', 'assets', 'css', 'style.css');
const css = fs.readFileSync(cssPath, 'utf8');
const fails = [];

const bodies = [...css.matchAll(/\/\* DARK-TOKENS-BEGIN \*\/([\s\S]*?)\/\* DARK-TOKENS-END \*\//g)]
  .map(m => m[1]);

if (bodies.length !== 2) {
  fails.push(`expected exactly 2 fenced DARK-TOKENS bodies, found ${bodies.length}`);
} else {
  const norm = s => s.replace(/\r\n/g, '\n').trim();
  if (norm(bodies[0]) !== norm(bodies[1])) {
    fails.push('the two DARK-TOKENS bodies differ — the toggle and the OS preference would drift');
  }
}

// Every slot declared in :root (minus purely-derived ones) should also be
// re-declared in dark, or a light value leaks into the dark theme.
const rootMatch = /:root\s*\{([\s\S]*?)\n\}/.exec(css);
if (!rootMatch) fails.push(':root block not found');
const slots = s => new Set([...s.matchAll(/--([\w-]+)\s*:/g)].map(m => m[1]));
const DERIVED = new Set(['display', 'body', 'mono', 'r-s', 'r-m', 'r-l', 'r-pill',
  'elev-1', 'elev-2', 'header-h', 'transport-h']); // theme-invariant by design

if (rootMatch && bodies.length === 2) {
  const light = slots(rootMatch[1]);
  const dark = slots(bodies[0]);
  const missing = [...light].filter(s => !dark.has(s) && !DERIVED.has(s));
  const extra = [...dark].filter(s => !light.has(s));
  if (missing.length) fails.push(`slots missing from dark: ${missing.join(', ')}`);
  if (extra.length) fails.push(`slots in dark but not :root: ${extra.join(', ')}`);
}

// The pre-paint script must run before the stylesheet or the theme flashes.
const njk = fs.readFileSync(path.join(__dirname, '..', '..', 'src', '_includes', 'base.njk'), 'utf8');
const prePaint = njk.indexOf("localStorage.getItem('dc_theme')");
const sheet = njk.indexOf('/assets/css/style.css');
if (prePaint === -1) fails.push('pre-paint theme script missing from base.njk');
else if (sheet !== -1 && prePaint > sheet) fails.push('pre-paint script runs after the stylesheet — theme will flash');

if (fails.length) {
  console.error('[check-dark-tokens] FAIL:');
  fails.forEach(f => console.error('  ' + f));
  process.exit(1);
}
console.log('[check-dark-tokens] OK — dark blocks identical, slot parity with :root, pre-paint ordered');
