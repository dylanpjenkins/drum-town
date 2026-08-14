#!/usr/bin/env node
// check-skip-targets.js — BL-073's gate. Three legs.
//
// The item this guards is "a keyboard user can reach the content in a bounded
// number of stops, by a real skip target and not a tabindex hack". Each half of
// that sentence is a separate failure mode, and one of them had been shipping
// broken for 70 iterations:
//
//   <a class="skip-link" href="#main">Skip to content</a>   ...   <main id="main">
//
// Pressing Enter on that set the hash and scrolled the page. It moved NO focus,
// because a fragment target that is not focusable leaves document.activeElement
// on <body> — so a screen-reader user heard nothing, and a keyboard user's next
// Tab went back to the site logo. Nothing in the build could see it: the markup
// is textbook, the anchor resolves, and a screenshot cannot photograph focus.
// The same silent failure was live on the four /rudiments/ family chips and on
// the-drum-kit's "drum key above" link.
//
//   (a) Over every built page, EVERY a[href^="#"] — not just the rail's —
//       resolves to exactly one element in the same document that is either
//       natively focusable or carries tabindex="-1".
//   (b) The homepage chapter panel, its ledger sections and src/_data/chapters.js
//       agree one-for-one and in order; site-wide, no tabindex is positive, every
//       tabindex is exactly -1, and every element carrying one is a real skip
//       target — an element some in-page link on its own page actually points at.
//       That is what turns "not a tabindex hack" into something the build
//       enforces rather than something a reviewer promises.
//   (c) In a REAL browser: pressing each rail link lands document.activeElement
//       on the intended element, on screen, and not on <body>. Non-negotiable,
//       because the chapter panel rests on Chromium focusing a display:none
//       element that :target reveals in the same frame — true in Edge 151,
//       guaranteed by no spec, and silent when it stops being true. This leg also
//       proves the closed panel costs zero tab stops.
//
// No jsdom anywhere. jsdom computes no CSS, so it cannot tell a revealed panel
// from a hidden one, and a jsdom tab-stop enumeration needs hand-coded
// subtractions to match what a browser actually does. Legs (a) and (b) are pure
// text questions and use a small quote-aware tag scanner; leg (c) is a layout
// question and uses Edge.
//
// Exits 0 on pass, 1 on fail, and 0 with a loud SKIP for leg (c) alone if no
// Edge/Chrome binary exists (legs a and b still run and still gate).

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SITE = path.join(ROOT, '_site');

// href values that are valid without resolving to any element. Both are defined
// by HTML as "the top of the document". `#` is also what the hero's returning-
// visitor CTA (#cta-continue) ships with: it is `hidden` until index.njk's
// activation script gives it a real lesson URL, and a placeholder that never
// becomes a live link is not a broken skip target.
const TOP_HREFS = new Set(['#', '#top']);

const failures = [];
const notes = [];

// ---------------------------------------------------------------- tiny HTML scan

// Comments and the contents of <script>/<style> are not markup for our purpose:
// the ld+json block and #lessons-data both contain quoted text that would
// otherwise read as attributes.
function stripInert(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
}

// Yields every start/end tag, walking to the closing '>' with quote awareness so
// an attribute value containing '>' (the exercise specs' JSON does) cannot cut a
// tag short. This is the whole reason not to use /<[^>]*>/g here.
function* tags(html) {
  let i = 0;
  for (;;) {
    const lt = html.indexOf('<', i);
    if (lt < 0) return;
    const next = html[lt + 1];
    if (!next || !/[a-zA-Z/]/.test(next)) { i = lt + 1; continue; }
    let j = lt + 1, quote = null;
    while (j < html.length) {
      const c = html[j];
      if (quote) { if (c === quote) quote = null; }
      else if (c === '"' || c === "'") quote = c;
      else if (c === '>') break;
      j++;
    }
    const raw = html.slice(lt, j + 1);
    i = j + 1;
    const m = /^<\s*(\/?)\s*([a-zA-Z][\w:-]*)/.exec(raw);
    if (m) yield { tag: m[2].toLowerCase(), end: m[1] === '/', raw };
  }
}

const ATTR_RE = /([a-zA-Z_:][-\w:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>]+)))?/g;
function attrs(raw) {
  const out = {};
  const body = raw.replace(/^<\s*[a-zA-Z][\w:-]*/, '').replace(/\/?>\s*$/, '');
  let m;
  ATTR_RE.lastIndex = 0;
  while ((m = ATTR_RE.exec(body))) {
    if (m.index === ATTR_RE.lastIndex) ATTR_RE.lastIndex++;   // zero-width guard
    const v = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : '';
    out[m[1].toLowerCase()] = v;
  }
  return out;
}

// Natively focusable, conservatively. <summary> is deliberately absent: it only
// takes focus as a child of <details>, which a flat tag scan cannot confirm, and
// the safe direction for this check is to demand an explicit tabindex="-1" (which
// costs nothing) rather than to assume.
function nativelyFocusable(tag, a) {
  switch (tag) {
    case 'a': case 'area': return 'href' in a;
    case 'button': case 'select': case 'textarea': case 'iframe': case 'object': case 'embed':
      return true;
    case 'input': return (a.type || '').toLowerCase() !== 'hidden';
    case 'audio': case 'video': return 'controls' in a;
    default: return false;
  }
}

function pageIndex(rel, html) {
  const clean = stripInert(html);
  const byId = new Map();     // id -> [{tag, a}]
  const fragLinks = [];       // {href, id, text}
  const tabindexed = [];      // {tag, a, id}
  const sections = [];        // ledger sections, in order
  const chapterLinks = [];    // #chapter-index chapter rows, in order
  const chapterCloses = [];   // the panel's own close control
  let inChapterIndex = 0;

  for (const t of tags(clean)) {
    if (t.end) {
      if (t.tag === 'nav' && inChapterIndex) inChapterIndex = 0;
      continue;                                                // end tags carry nothing else
    }
    const a = attrs(t.raw);
    if (t.tag === 'nav' && a.id === 'chapter-index') inChapterIndex = 1;
    if (a.id) {
      if (!byId.has(a.id)) byId.set(a.id, []);
      byId.get(a.id).push({ tag: t.tag, a });
    }
    if (t.tag === 'a' && a.href && a.href.startsWith('#')) {
      fragLinks.push({ href: a.href, id: decodeURIComponent(a.href.slice(1)), cls: a.class || '' });
      // The close control lives in the panel but is not a chapter, so it must not
      // be counted against the 19.
      if (inChapterIndex) {
        if (/\bchapter-index__close\b/.test(a.class || '')) chapterCloses.push(a.href);
        else chapterLinks.push(a.href.slice(1));
      }
    }
    if ('tabindex' in a) tabindexed.push({ tag: t.tag, a, id: a.id || null });
    if (t.tag === 'section' && /\bledger\b/.test(a.class || '')) sections.push(a);
  }
  return { rel, byId, fragLinks, tabindexed, sections, chapterLinks, chapterCloses };
}

// ---------------------------------------------------------------- collect pages

if (!fs.existsSync(path.join(SITE, 'index.html'))) {
  console.error('[check-skip-targets] FAIL — _site is missing. Run `npm run build` first.');
  process.exit(1);
}

const htmlFiles = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (path.relative(SITE, p).split(path.sep)[0] === 'dev') continue;   // dev-only pages
      walk(p);
    } else if (e.name.endsWith('.html')) htmlFiles.push(p);
  }
})(SITE);

const pages = htmlFiles.map(f =>
  pageIndex(path.relative(SITE, f).replace(/\\/g, '/'), fs.readFileSync(f, 'utf8')));

// ---------------------------------------------------------------- leg (a)

let fragChecked = 0;
const skipTargetKinds = new Map();   // "tag#id" -> pages seen on

for (const p of pages) {
  for (const link of p.fragLinks) {
    if (TOP_HREFS.has(link.href)) continue;
    fragChecked++;
    const hits = p.byId.get(link.id);
    if (!hits) {
      failures.push(`(a) ${p.rel}: <a href="${link.href}"> points at no element in this document`);
      continue;
    }
    if (hits.length > 1) {
      failures.push(`(a) ${p.rel}: id="${link.id}" appears ${hits.length} times — the anchor is ambiguous`);
      continue;
    }
    const { tag, a } = hits[0];
    const ti = 'tabindex' in a ? String(a.tabindex).trim() : null;
    const focusable = nativelyFocusable(tag, a) || (ti !== null && Number.isFinite(Number(ti)));
    if (!focusable) {
      failures.push(
        `(a) ${p.rel}: <a href="${link.href}"> resolves to <${tag}> which cannot take focus. ` +
        `Enter sets the hash, focus stays on <body>, and nothing is announced. Add tabindex="-1" to it.`);
      continue;
    }
    if (ti !== null) {
      const key = `<${tag}#${link.id}>`;
      if (!skipTargetKinds.has(key)) skipTargetKinds.set(key, 0);
      skipTargetKinds.set(key, skipTargetKinds.get(key) + 1);
    }
  }
}

// Every page must carry the rail, and #main must be its first link — the
// contract dom-smoke.js pins from the other side.
for (const p of pages) {
  const rail = p.fragLinks.filter(l => /\bskip-link\b/.test(l.cls));
  if (!rail.length) { failures.push(`(a) ${p.rel}: no skip-link in the page`); continue; }
  if (rail[0].href !== '#main') failures.push(`(a) ${p.rel}: first skip link is ${rail[0].href}, must be #main`);
  if (!rail.some(l => l.href === '#site-footer')) failures.push(`(a) ${p.rel}: rail has no #site-footer link`);
}

// ---------------------------------------------------------------- leg (b)

// b1 — no positive tabindex anywhere, and nothing but -1 at all. A positive
// value is the hack the acceptance forbids: it lifts an element out of DOM order
// into a global ordering that every later template edit has to remember.
// tabindex="0" is barred too — it ADDS a tab stop, and this item exists to
// remove them.
let negativeCount = 0;
for (const p of pages) {
  for (const t of p.tabindexed) {
    const v = String(t.a.tabindex).trim();
    if (v !== '-1') {
      failures.push(`(b) ${p.rel}: <${t.tag}${t.id ? '#' + t.id : ''}> has tabindex="${v}"` +
        (Number(v) > 0
          ? ' — a positive tabindex is exactly the hack this item rules out'
          : ' — the only value this site uses is -1 (a focusable skip target)'));
      continue;
    }
    negativeCount++;
    // b2 — every negative tabindex is a documented skip target: it has an id,
    // and some in-page link on this very page points at it. An orphan
    // tabindex="-1" is dead weight at best and a focus trap at worst.
    if (!t.id) {
      failures.push(`(b) ${p.rel}: <${t.tag}> carries tabindex="-1" with no id — it can never be a skip target`);
      continue;
    }
    if (!p.fragLinks.some(l => l.id === t.id)) {
      failures.push(`(b) ${p.rel}: <${t.tag}#${t.id}> carries tabindex="-1" but no in-page link points at it`);
    }
  }
}

// b3 — the homepage chapter panel, the ledger sections and the data file agree.
const home = pages.find(p => p.rel === 'index.html');
if (!home) {
  failures.push('(b) index.html missing from _site');
} else {
  const chapters = require(path.join(ROOT, 'src', '_data', 'chapters.js'));
  const sectionIds = home.sections.map(s => s.id || '(no id)');
  const dataIds = chapters.map(c => c.id);
  if (home.chapterLinks.length !== sectionIds.length) {
    failures.push(`(b) index.html: #chapter-index has ${home.chapterLinks.length} links but the page has ${sectionIds.length} section.ledger blocks`);
  }
  if (sectionIds.length !== dataIds.length) {
    failures.push(`(b) index.html: ${sectionIds.length} section.ledger blocks vs ${dataIds.length} chapters in src/_data/chapters.js`);
  }
  const n = Math.max(home.chapterLinks.length, sectionIds.length, dataIds.length);
  for (let i = 0; i < n; i++) {
    const a = home.chapterLinks[i], b = sectionIds[i], c = dataIds[i];
    if (a !== b || b !== c) {
      failures.push(`(b) index.html: chapter ${i + 1} disagrees — panel link #${a}, section id ${b}, chapters.js ${c}`);
    }
  }
  // The panel must carry exactly one way out, and it must be the one that both
  // closes the panel and lands the reader somewhere (WCAG 2.4.11 — see the note
  // in index.njk). Any other href would drop :target without giving focus a home.
  if (home.chapterCloses.length !== 1 || home.chapterCloses[0] !== '#main') {
    failures.push(`(b) index.html: #chapter-index must contain exactly one .chapter-index__close with href="#main", found ${JSON.stringify(home.chapterCloses)}. ` +
      `Without it, tabbing past the last chapter lands on a control the panel completely covers at 390px, and nothing can dismiss it.`);
  }
  // Each section is a NAMED region or it announces nothing on arrival.
  for (const s of home.sections) {
    if (!s['aria-labelledby']) failures.push(`(b) index.html: <section class="ledger" id="${s.id}"> has no aria-labelledby — it is an unnamed region`);
    else if (!home.byId.has(s['aria-labelledby'])) failures.push(`(b) index.html: section #${s.id} aria-labelledby="${s['aria-labelledby']}" resolves to nothing`);
  }
  notes.push(`chapter panel: ${home.chapterLinks.length} links == ${sectionIds.length} ledger sections == ${dataIds.length} in chapters.js, ids in order`);
}

notes.push(`negative tabindex site-wide: ${negativeCount}, all -1, all linked. Kinds: ` +
  [...skipTargetKinds.entries()].sort().map(([k, n]) => `${k} x${n}`).join(', '));

if (failures.length) {
  console.error('[check-skip-targets] FAIL:');
  failures.slice(0, 40).forEach(f => console.error('  ' + f));
  if (failures.length > 40) console.error(`  … and ${failures.length - 40} more`);
  process.exit(1);
}

// ---------------------------------------------------------------- leg (c)

const BROWSER = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/microsoft-edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find(p => fs.existsSync(p));

function passStatic() {
  console.log(`[check-skip-targets] legs (a)+(b) OK — ${fragChecked} in-page anchors across ${pages.length} pages all resolve to a focusable element.`);
  notes.forEach(n => console.log('  ' + n));
}

if (!BROWSER) {
  passStatic();
  console.warn('[check-skip-targets] SKIP (c) — no Edge/Chrome binary found; the real-browser focus leg cannot run here.');
  console.warn('  Legs (a) and (b) passed, but the claim that :target reveals #chapter-index in time for it');
  console.warn('  to take focus is a LAYOUT claim and is unverified on this machine. Re-run where Edge exists.');
  process.exit(0);
}

// ---- what leg (c) samples ----
// ONE page per src template, discovered from _site rather than typed, plus a
// completeness assertion: every built page must match one of these shapes, so a
// new template cannot be added without either being sampled or failing here.
// Four hand-picked URLs was not enough — legs (a) and (b) compute no CSS, so a
// `style="display:none"` on #exercises or an `inert` <main> is invisible to them,
// and a page shape leg (c) never visits is a page shape nothing checks.
const SHAPES = [
  { template: 'index.njk', re: /^index\.html$/ },
  { template: 'lessons.njk', re: /^lessons\/[^/]+\/index\.html$/ },
  { template: 'rudiments.njk', re: /^rudiments\/index\.html$/ },
  { template: 'genres.njk', re: /^genres\/[^/]+\/index\.html$/ },
  { template: 'metronome.njk', re: /^metronome\/index\.html$/ },
  { template: '404.njk', re: /^404\.html$/ },
];
const unmatched = pages.filter(p => !SHAPES.some(s => s.re.test(p.rel))).map(p => p.rel);
if (unmatched.length) {
  console.error('[check-skip-targets] FAIL — built pages that leg (c) has no shape for:');
  unmatched.slice(0, 10).forEach(u => console.error('  ' + u));
  console.error('\n  A new template ships a new rail and a new set of skip targets. Add it to SHAPES.');
  process.exit(1);
}
const PAGES = SHAPES.map(s => {
  const hit = pages.map(p => p.rel).sort().find(rel => s.re.test(rel));
  if (!hit) {
    console.error(`[check-skip-targets] FAIL — no built page matches ${s.template}; _site is incomplete.`);
    process.exit(1);
  }
  return '/' + hit.replace(/index\.html$/, '');
});
const WIDTHS = [1280, 390];

// ---- committed press bounds: BL-073's acceptance, as numbers ----
// "a small bounded number of stops" is the whole item, so it is asserted rather
// than measured-once-and-reported. Every figure is presses from a COLD page load,
// counting Tab and Enter alike, and every one is content-independent: N Tabs to
// reach rail link N, one Enter, then Tabs from the target.
const MAX_PRESS = {
  firstExerciseControl: 4,   // rail link 2, Enter, one Tab -> the kit selector
  firstPlay: 6,              // ...plus the tempo-handoff button where it exists
  firstFooterLink: 5,        // rail link 3 on the 3-link rails, 4 on the 2-link ones
  lastChapter: 22,           // rail link 2, Enter, 19 Tabs -> chapter 19 focused
  panelClose: 23,            // one more Tab -> the panel's way out
};
// Re-inflation budgets. Iteration 64 took /rudiments/ from 112 to 152 tab stops
// (+36%) with nothing watching, by adding one control per exercise. These two
// numbers are what watch now.
//   chromeStops = total stops MINUS every stop that is one-per-content-item
//     (a link to a lesson, or a control inside an exercise). Adding lessons or
//     exercises therefore does not move it; adding fixed chrome does.
//   stopsPerExercise = the most tab stops any single .exercise-controls block
//     costs. This is the number iteration 64 moved from 2 to 3.
// Both are committed baselines in the sense tools/audit-site-baseline.json is:
// raise them only in the same change that spends the stops, and say why.
const MAX_STOPS_PER_EXERCISE = 3;
// Measured 2026-08-14, exactly, no slack — a budget with headroom is a budget
// nobody notices spending. The 390px column is smaller because the five header
// nav links collapse behind the hamburger; the genres column is the largest
// because its section-nav island lists every track.
const MAX_CHROME_STOPS = {
  'index.njk': { 1280: 17, 390: 13 },
  'lessons.njk': { 1280: 19, 390: 15 },
  'rudiments.njk': { 1280: 20, 390: 16 },
  'genres.njk': { 1280: 28, 390: 15 },
  'metronome.njk': { 1280: 17, 390: 13 },
  '404.njk': { 1280: 18, 390: 14 },
};

// `link.click()` rather than a synthesised keydown: an untrusted KeyboardEvent
// runs no default action in Chromium, so a dispatched Enter would navigate
// nowhere and this leg would pass on a site whose rail was completely dead.
// .click() runs the real navigate-to-a-fragment steps — style recalc, scroll,
// and "set the sequential focus navigation starting point and focus the target
// if it is focusable" — which is precisely the behavior under test. The one
// thing it does not reproduce is the :focus-visible heuristic, which decides how
// the ring is PAINTED, not where focus lands.
const HARNESS = `<!doctype html><meta charset="utf-8"><body style="margin:0"><div id="o">pending</div><script>
var PAGES=__PAGES__, WIDTHS=__WIDTHS__;
var out=[], jobs=[];
PAGES.forEach(function(p){ WIDTHS.forEach(function(w){ jobs.push({page:p.page,template:p.template,w:w}); }); });
var f=document.createElement('iframe');
f.style.cssText='border:0;position:absolute;left:-9000px;top:0';
document.body.appendChild(f);

function hiddenFor(el, cw){
  for (var e=el; e && e.nodeType===1; e=e.parentElement){
    var cs=cw.getComputedStyle(e);
    if (cs.display==='none') return true;
    if (cs.contentVisibility==='hidden') return true;
    if (e.hasAttribute('inert')) return true;
  }
  return cw.getComputedStyle(el).visibility!=='visible';
}
var SEL='a[href],button,input,select,textarea,iframe,object,embed,area[href],audio[controls],video[controls],[tabindex]';
function tabbables(d, cw){
  var all=d.querySelectorAll(SEL), list=[];
  for (var i=0;i<all.length;i++){
    var el=all[i];
    if (el.disabled) continue;
    if (el.tagName==='INPUT' && el.type==='hidden') continue;
    var ti=el.getAttribute('tabindex');
    if (ti!==null && Number(ti)<0) continue;
    if (hiddenFor(el, cw)) continue;
    list.push(el);
  }
  return list;
}
function desc(el){
  if(!el) return 'null';
  var s=el.tagName.toLowerCase();
  if (el.id) s+='#'+el.id;
  var c=(el.className&&typeof el.className==='string')?el.className.trim().split(/\\s+/)[0]:'';
  if (c) s+='.'+c;
  return s;
}
// The tab stops that FOLLOW a focused element, in DOM order.
// NOT seq.indexOf(ae): every skip target carries tabindex="-1", so it is never a
// member of the tabbable list and indexOf is -1 every single time. That bug made
// the whole press-bound half of this leg silently vacuous once already.
function following(seq, ae){
  var res=[];
  for (var k=0;k<seq.length;k++){
    if (ae.compareDocumentPosition(seq[k]) & 4 /* DOCUMENT_POSITION_FOLLOWING */) res.push(seq[k]);
  }
  return res;
}
// How much of el is inside the rectangle another element paints? Proves the chapter
// panel does not sit on top of the stop the reader lands on (WCAG 2.4.11).
function coveredBy(el, box){
  if (!box || !box.getClientRects().length) return 0;
  var a=el.getBoundingClientRect(), b=box.getBoundingClientRect();
  var w=Math.max(0, Math.min(a.right,b.right)-Math.max(a.left,b.left));
  var h=Math.max(0, Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
  return (a.width*a.height)>0 ? (w*h)/(a.width*a.height) : 0;
}

function run(i){
  if (i>=jobs.length){ document.getElementById('o').textContent=JSON.stringify(out); return; }
  var job=jobs[i];
  f.style.width=job.w+'px'; f.style.height=(job.w===390?844:900)+'px';
  f.onload=function(){ setTimeout(function(){
    var r={page:job.page,template:job.template,w:job.w,acts:[]};
    try{
      var d=f.contentDocument, cw=f.contentWindow;
      var seq0=tabbables(d,cw);
      r.total=seq0.length;
      // The per-content stops, so the chrome budget below is content-independent.
      var perItem=0, blocks={};
      seq0.forEach(function(e){
        var ctl=e.closest?e.closest('.exercise-controls'):null;
        if (ctl){ perItem++; var k=[].indexOf.call(d.querySelectorAll('.exercise-controls'),ctl); blocks[k]=(blocks[k]||0)+1; return; }
        if (e.tagName==='A' && (e.getAttribute('href')||'').indexOf('/lessons/')===0) perItem++;
      });
      r.chromeStops=r.total-perItem;
      r.stopsPerExercise=Object.keys(blocks).reduce(function(m,k){return Math.max(m,blocks[k]);},0);
      r.exerciseBlocks=d.querySelectorAll('.exercise-controls').length;

      var ci=d.getElementById('chapter-index');
      if (ci){
        r.closedRects=ci.getClientRects().length;
        r.closedTabbable=tabbables(d,cw).filter(function(e){return ci.contains(e);}).length;
        r.closedDisplay=cw.getComputedStyle(ci).display;
      }
      var rail=[].slice.call(d.querySelectorAll('a.skip-link'));
      r.railCount=rail.length;
      rail.forEach(function(link, railIdx){
        var href=link.getAttribute('href'), id=href.slice(1);
        var want=d.getElementById(id);
        link.focus();
        var railRect=link.getBoundingClientRect();
        // The rail link's OWN geometry while focused. A rail pinned offscreen is
        // a rail nobody can read, and a static scan cannot see it.
        var a={href:href, exists:!!want, railRects:link.getClientRects().length,
          railVisible: link.getClientRects().length>0 && railRect.width>0 && railRect.height>0
            && railRect.left>=0 && railRect.top>=0
            && railRect.right<=cw.innerWidth+0.5 && railRect.bottom<=cw.innerHeight+0.5,
          railRect:[Math.round(railRect.left),Math.round(railRect.top),Math.round(railRect.width),Math.round(railRect.height)]};
        link.click();
        var ae=d.activeElement;
        var rect=ae&&ae.getBoundingClientRect?ae.getBoundingClientRect():null;
        a.focused=desc(ae);
        a.landed=!!want && ae===want;
        a.isBody=(ae===d.body || ae===d.documentElement || ae===null);
        a.targetMatches=want?want.matches(':target'):null;
        a.rects=want?want.getClientRects().length:null;
        a.inert=want?!!(want.closest&&want.closest('[inert]')):null;
        a.onScreen=!!rect && rect.width>0 && rect.top>-2 && rect.top<cw.innerHeight;
        a.rect=rect?[Math.round(rect.left),Math.round(rect.top),Math.round(rect.width),Math.round(rect.height)]:null;
        // presses: railIdx+1 Tabs to reach this rail link, +1 for Enter.
        a.pressToLand=railIdx+2;
        var next=(ae&&ae.compareDocumentPosition)?following(tabbables(d,cw),ae):[];
        a.nextThree=next.slice(0,3).map(desc);
        a.followCount=next.length;
        function pressAt(k){ return k<0?null:a.pressToLand+k+1; }

        if (href==='#exercises'){
          var ctlAt=-1, playAt=-1;
          for (var k=0;k<next.length;k++){
            if (ctlAt<0 && next[k].closest && next[k].closest('.exercise-controls')) ctlAt=k;
            if (playAt<0 && next[k].hasAttribute('data-exercise-play')) playAt=k;
          }
          a.pressFirstControl=pressAt(ctlAt);
          a.pressPlay=pressAt(playAt);
          a.firstFollowIsControl=(ctlAt===0);
        }
        if (href==='#site-footer'){
          var fAt=-1;
          for (var k2=0;k2<next.length;k2++){ if (next[k2].closest && next[k2].closest('.site-footer')) { fAt=k2; break; } }
          a.pressFirstFooterLink=pressAt(fAt);
          a.firstFollowIsFooterLink=(fAt===0);
        }
        if (href==='#chapter-index'){
          var rows=[].slice.call(d.querySelectorAll('#chapter-index a:not(.chapter-index__close)'));
          var close=d.querySelector('#chapter-index .chapter-index__close');
          a.chapterCount=rows.length;
          a.chaptersContiguous=rows.every(function(x,n){return next[n]===x;});
          a.pressLastChapter=pressAt(rows.length-1);
          a.closeIsNext=(next[rows.length]===close);
          a.pressClose=pressAt(next.indexOf(close));
          a.closeHref=close?close.getAttribute('href'):null;
          // WCAG 2.4.11: nothing the reader can focus while the panel is open may
          // be hidden behind the panel. Walk every stop the panel offers plus the
          // two after it and record the worst coverage.
          var worst=0, worstEl=null;
          next.slice(0, rows.length+3).forEach(function(e){
            if (ci.contains(e)) return;   // inside the panel is not "behind" it
            var c=coveredBy(e, ci);
            if (c>worst){ worst=c; worstEl=e; }
          });
          a.worstCoverage=Math.round(worst*100);
          a.worstCovered=worstEl?desc(worstEl):null;
        }
        r.acts.push(a);
        d.location.hash='';
        cw.scrollTo(0,0);
      });
    }catch(err){ r.error=String((err&&err.stack)||err); }
    out.push(r);
    run(i+1);
  },260); };
  f.src=job.page;
}
run(0);
</script></body>`
  .replace('__PAGES__', JSON.stringify(PAGES.map((page, i) => ({ page, template: SHAPES[i].template }))))
  .replace('__WIDTHS__', JSON.stringify(WIDTHS));

// The harness lives under _site/dev/, which every audit walk already skips, so a
// crashed run cannot change info.pageCount or dom.pagesMissingMain.
const DEV = path.join(SITE, 'dev');
const harnessRel = 'dev/__skip-targets-check.html';
const harnessPath = path.join(SITE, harnessRel);
const devPreexisting = fs.existsSync(DEV);
fs.mkdirSync(DEV, { recursive: true });
fs.writeFileSync(harnessPath, HARNESS, 'utf8');

const TYPES = { '.html': 'text/html;charset=utf-8', '.css': 'text/css;charset=utf-8',
  '.js': 'text/javascript;charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.wav': 'audio/wav', '.json': 'application/json', '.xml': 'application/xml' };

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  let f = path.join(SITE, p);
  try { if (fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); } catch (e) { /* 404 below */ }
  fs.readFile(f, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    res.end(buf);
  });
});

function cleanup() {
  try { fs.unlinkSync(harnessPath); } catch (e) {}
  if (!devPreexisting) { try { fs.rmSync(DEV, { recursive: true, force: true }); } catch (e) {} }
  try { server.close(); } catch (e) {}
}

server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-skip-'));
  let dom = '';
  try {
    // spawn, NOT execFileSync: the static server is in this process, so blocking
    // the event loop would leave the browser waiting on a request nobody answers.
    dom = await new Promise((resolve, reject) => {
      const child = spawn(BROWSER, [
        '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
        '--user-data-dir=' + profile, '--timeout=60000', '--virtual-time-budget=55000',
        '--window-size=1700,1000', '--dump-dom', `http://127.0.0.1:${port}/${harnessRel}`,
      ], { stdio: ['ignore', 'pipe', 'ignore'] });
      let buf = '';
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', d => { buf += d; });
      child.on('error', reject);
      child.on('close', () => resolve(buf));
    });
  } catch (e) {
    cleanup();
    console.error('[check-skip-targets] FAIL — could not run the browser: ' + e.message);
    process.exit(1);
  } finally {
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  }
  cleanup();

  const m = dom.match(/<div id="o">([\s\S]*?)<\/div>/);
  if (!m || m[1].trim() === 'pending') {
    console.error('[check-skip-targets] FAIL — the browser harness produced no measurements.');
    process.exit(1);
  }
  let rows;
  try {
    rows = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
  } catch (e) {
    console.error('[check-skip-targets] FAIL — unreadable harness output: ' + e.message);
    process.exit(1);
  }
  if (rows.length !== PAGES.length * WIDTHS.length) {
    console.error(`[check-skip-targets] FAIL — expected ${PAGES.length * WIDTHS.length} page/width runs, got ${rows.length}.`);
    process.exit(1);
  }

  const bad = [];
  let acts = 0;
  const press = [];   // pass-line evidence
  for (const r of rows) {
    const at = `${r.page} @${r.w}px`;
    if (r.error) { bad.push(`${at} — harness error: ${r.error}`); continue; }
    if (!r.railCount) { bad.push(`${at} — no rail links found in the live page`); continue; }
    if (r.closedRects !== undefined) {
      if (r.closedRects !== 0) bad.push(`${at} — #chapter-index has ${r.closedRects} client rects while closed (display: ${r.closedDisplay}); it is on screen when it should not be`);
      if (r.closedTabbable !== 0) bad.push(`${at} — #chapter-index costs ${r.closedTabbable} tab stops while closed; the panel must be free until opened`);
    }

    // ---- re-inflation budgets ----
    const budget = (MAX_CHROME_STOPS[r.template] || {})[r.w];
    if (budget === undefined) bad.push(`${at} — no chrome-stop budget committed for ${r.template} at ${r.w}px`);
    else if (r.chromeStops > budget) {
      bad.push(`${at} — ${r.chromeStops} chrome tab stops against a budget of ${budget} (total ${r.total}, ` +
        `of which ${r.total - r.chromeStops} are one-per-content-item). Fixed chrome grew: either take the stops ` +
        `back out, or raise MAX_CHROME_STOPS in the same change and say what bought them.`);
    }
    if (r.stopsPerExercise > MAX_STOPS_PER_EXERCISE) {
      bad.push(`${at} — an exercise costs ${r.stopsPerExercise} tab stops, budget ${MAX_STOPS_PER_EXERCISE}. ` +
        `On this page that is x${r.exerciseBlocks}. This is the exact shape of iteration 64's +40 stops on /rudiments/.`);
    }

    for (const a of r.acts) {
      acts++;
      if (!a.exists) { bad.push(`${at} — rail link ${a.href} has no target element`); continue; }
      if (!a.railVisible) bad.push(`${at} — the rail link ${a.href} was not fully on screen while focused: ${a.railRects} client rects at ${JSON.stringify(a.railRect)}`);
      if (a.isBody) {
        bad.push(`${at} — pressing ${a.href} left focus on <body>. The hash moved, the reader did not. ` +
                 `The target needs tabindex="-1".`);
        continue;
      }
      if (!a.landed) bad.push(`${at} — pressing ${a.href} focused <${a.focused}>, not the target`);
      if (!a.rects) bad.push(`${at} — ${a.href} target has no client rects at the instant it takes focus`);
      if (a.inert) bad.push(`${at} — ${a.href} target is inside an [inert] subtree; focus cannot reach it whatever the markup says`);
      if (!a.onScreen) bad.push(`${at} — ${a.href} target is focused off screen at ${JSON.stringify(a.rect)} (viewport ${r.w}px)`);

      // ---- the press bounds: the item's acceptance, as assertions ----
      if (a.href === '#main' && !a.followCount) {
        bad.push(`${at} — #main is focusable but has no tab stop after it; the page's content is unreachable by Tab`);
      }
      if (a.href === '#exercises') {
        if (!a.firstFollowIsControl) bad.push(`${at} — the first stop after #exercises is ${a.nextThree[0]}, not an exercise control. Something was inserted between the heading and the exercise it names.`);
        if (a.pressPlay === null) bad.push(`${at} — no Play button follows #exercises at all`);
        if (a.pressFirstControl === null || a.pressFirstControl > MAX_PRESS.firstExerciseControl) {
          bad.push(`${at} — ${a.pressFirstControl} presses to the first exercise control, bound ${MAX_PRESS.firstExerciseControl}`);
        }
        if (a.pressPlay !== null && a.pressPlay > MAX_PRESS.firstPlay) {
          bad.push(`${at} — ${a.pressPlay} presses to the first Play, bound ${MAX_PRESS.firstPlay}`);
        }
        press.push(`${r.template}@${r.w}: control ${a.pressFirstControl}, Play ${a.pressPlay}`);
      }
      if (a.href === '#site-footer') {
        if (!a.firstFollowIsFooterLink) bad.push(`${at} — the first stop after #site-footer is ${a.nextThree[0]}, which is outside the footer`);
        if (a.pressFirstFooterLink === null || a.pressFirstFooterLink > MAX_PRESS.firstFooterLink) {
          bad.push(`${at} — ${a.pressFirstFooterLink} presses to the first footer link, bound ${MAX_PRESS.firstFooterLink}`);
        }
      }
      if (a.href === '#chapter-index') {
        if (a.targetMatches !== true) bad.push(`${at} — #chapter-index did not match :target after activation, so the panel never opened`);
        if (!a.chaptersContiguous) bad.push(`${at} — the 19 chapter links are not the first 19 stops after the panel`);
        if (a.pressLastChapter === null || a.pressLastChapter > MAX_PRESS.lastChapter) {
          bad.push(`${at} — ${a.pressLastChapter} presses to chapter ${a.chapterCount}, bound ${MAX_PRESS.lastChapter}`);
        }
        if (!a.closeIsNext || a.closeHref !== '#main') {
          bad.push(`${at} — the stop after the last chapter is ${a.nextThree.join('/')} rather than the panel's close control (href ${a.closeHref})`);
        }
        if (a.pressClose === null || a.pressClose > MAX_PRESS.panelClose) {
          bad.push(`${at} — ${a.pressClose} presses to the panel's way out, bound ${MAX_PRESS.panelClose}`);
        }
        // WCAG 2.4.11 Focus Not Obscured (AA)
        if (a.worstCoverage >= 100) {
          bad.push(`${at} — with the panel open, ${a.worstCovered} takes focus ${a.worstCoverage}% hidden behind it. ` +
            `WCAG 2.4.11: no focused control may be entirely obscured. Give the panel a way out that the reader ` +
            `reaches BEFORE tabbing under it, or stop it overlapping the content.`);
        }
        press.push(`${r.template}@${r.w}: chapter ${a.chapterCount} at ${a.pressLastChapter}, close at ${a.pressClose}, worst coverage behind the panel ${a.worstCoverage}%`);
      }
    }
  }

  if (bad.length) {
    console.error('[check-skip-targets] FAIL — leg (c), in a real browser:');
    bad.slice(0, 30).forEach(b => console.error('  ' + b));
    if (bad.length > 30) console.error(`  … and ${bad.length - 30} more`);
    console.error('\n  A fragment link only moves focus when its target can hold focus. Add tabindex="-1"');
    console.error('  to the target — it adds no tab stop. If #chapter-index failed, Chromium has stopped');
    console.error('  focusing a display:none element that :target reveals in the same frame, and the panel');
    console.error('  needs a mechanism that does not depend on that (a <details> disclosure, or JS focus).');
    process.exit(1);
  }

  passStatic();
  const home = rows.filter(r => r.page === '/');
  console.log(`[check-skip-targets] leg (c) OK — ${acts} real activations over ${SHAPES.length} templates x ${WIDTHS.length} widths; every one moved focus to its target, on screen, not inert, never <body>.`);
  console.log(`  closed #chapter-index: 0 client rects and 0 tab stops at ${home.map(r => r.w + 'px').join(' and ')}`);
  [...new Set(press)].forEach(p => console.log('  ' + p));
  console.log(`  chrome stops vs budget: ${rows.map(r => `${r.template}@${r.w} ${r.chromeStops}/${(MAX_CHROME_STOPS[r.template] || {})[r.w]}`).join('  ')}`);
  console.log(`  total live stops: ${rows.map(r => `${r.page}@${r.w}=${r.total}`).join('  ')}`);
  process.exit(0);
});
