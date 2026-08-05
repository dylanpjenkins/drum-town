// tools/checks/check-nav-a11y.js
// Keyboard contract for the mobile nav disclosure, driven against the real
// chrome.js in a DOM. Screenshots cannot see focus; this can.
//
// Guards the two blocking bugs found by the accessibility persona at iter 30:
//   1. opening the panel must move focus INTO it (the <nav> precedes the
//      buttons in the DOM but renders below them, so Tab would otherwise walk
//      into the page behind the open panel)
//   2. activating a link must hand focus somewhere deliberate — never <body>,
//      which is what happens when the focused element is display:none'd
// Exit 0 = pass.

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');
const page = path.join(ROOT, '_site', 'index.html');
// argv[2] lets a mutated copy be substituted to prove this gate can fail.
const chromeSrc = process.argv[2] || path.join(ROOT, 'src', 'assets', 'js', 'chrome.js');
const chromeJs = fs.readFileSync(chromeSrc, 'utf8');

if (!fs.existsSync(page)) {
  console.error('[check-nav-a11y] FAIL: _site/index.html missing — run npm run build');
  process.exit(1);
}

const dom = new JSDOM(fs.readFileSync(page, 'utf8'), {
  runScripts: 'dangerously',   // external <script src> are NOT fetched (no `resources`)
  pretendToBeVisual: true
});
const { window } = dom;
const { document } = window;

// jsdom has no matchMedia; chrome.js only reads .matches and (un)subscribes.
window.matchMedia = q => ({
  matches: false, media: q,
  addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}
});

// Run the real chrome.js the way the browser would.
const el = document.createElement('script');
el.textContent = chromeJs;
document.body.appendChild(el);

const fails = [];
const toggle = document.getElementById('nav-toggle');
const nav = document.getElementById('site-nav');
const root = document.documentElement;

if (!toggle || !nav) {
  console.error('[check-nav-a11y] FAIL: #nav-toggle or #site-nav missing from the built page');
  process.exit(1);
}

const links = [...nav.querySelectorAll('a')];
if (links.length < 5) fails.push(`nav has ${links.length} links, expected at least 5 destinations`);
for (const dest of ['/rudiments/', '/metronome/']) {
  if (!links.some(a => a.getAttribute('href') === dest)) fails.push(`nav is missing ${dest}`);
}

// --- open: state flips and focus lands inside the panel ---
toggle.click();
if (!root.classList.contains('nav-open')) fails.push('open: html.nav-open not set');
if (toggle.getAttribute('aria-expanded') !== 'true') fails.push('open: aria-expanded not "true"');
if (!nav.contains(document.activeElement)) {
  fails.push(`open: focus went to <${(document.activeElement || {}).tagName}> outside the panel — the panel is unreachable by Tab`);
}

// --- Escape: closes and returns focus to the toggle ---
document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
if (root.classList.contains('nav-open')) fails.push('Escape: panel did not close');
if (document.activeElement !== toggle) fails.push('Escape: focus not returned to the toggle');

// --- link activation: closes without dumping focus to <body> ---
toggle.click();
const hashLink = links.find(a => (a.getAttribute('href') || '').startsWith('/#')) || links[0];
hashLink.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
if (root.classList.contains('nav-open')) fails.push('link: panel did not close on activation');
if (document.activeElement === document.body || document.activeElement === null) {
  fails.push('link: focus dumped to <body> — the reader loses their place');
}

// --- toggle labelling: an action label, and no contradictory pressed state ---
if (!/^Switch to (light|dark) theme$/.test(document.getElementById('theme-toggle').getAttribute('aria-label') || '')) {
  fails.push('theme toggle: aria-label is not an action label');
}
if (document.getElementById('theme-toggle').hasAttribute('aria-pressed')) {
  fails.push('theme toggle: aria-pressed contradicts the action label ("do this" + "already done")');
}

if (fails.length) {
  console.error('[check-nav-a11y] FAIL:');
  fails.forEach(f => console.error('  ' + f));
  process.exit(1);
}
console.log('[check-nav-a11y] OK — focus enters the panel, Escape restores it, links never drop focus, toggle labelled cleanly');
