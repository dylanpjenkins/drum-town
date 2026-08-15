#!/usr/bin/env node
// check-header-shed.js — BL-064 + BL-092.
//
// The header row is `logo + theme toggle + clock pill + hamburger`, every item
// flex-shrink: 0, and it has twice been the thing that broke the site at the
// extremes. Adding the clock pill pushed a sideways scroll onto all 228 pages
// below 333px. And at a 24px root the row's only shrinkable item — the site's
// own name — rendered 155px into a 126px slot with `text-overflow: clip`, so
// the wordmark read "drum.tov" and NOTHING reported it: no overflow, no gate,
// no visible sign of truncation. Silence is the failure mode this check exists
// to end.
//
// style.css now sheds the row by an explicit priority order (see HEADER
// SHEDDING LADDER there), driven by @container so the thresholds grow with the
// root font instead of being deaf to it, and chrome.js walks the same order
// when the row still does not fit. This check proves both halves in a real
// browser, because none of it is visible in the DOM and none of it is visible
// in a 1280px screenshot.
//
//   Pass A — the ladder.   14 widths x 4 root font sizes, CSS only.
//   Pass B — the reserve.  A 44px probe control added to the header markup, the
//                          way a future feature would add one, at 11 widths x 2
//                          roots. This is BL-064's own acceptance test.
//
// Both passes assert the same five invariants at every cell:
//   1. the row does not overflow its own content box
//   2. the wordmark is either whole or absent — never clipped
//   3. the clock pill is present (below the fold it is the only route to the
//      metronome)
//   4. navigation is present — the nav row or the hamburger, never neither
//   5. exactly one theme control exists, and if it is the menu row then the
//      hamburger that opens the menu is rendered
// ...plus the ORDER itself: no step may be taken while a cheaper one above it
// in the ladder has not been.
//
// Exits 0 on pass, 1 on fail, and 0 with a loud SKIP if no Edge/Chrome is
// installed (the metric gates still run on such machines; this one cannot).

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SITE = path.join(ROOT, '_site');

const PAGE_A = '/lessons/paradiddle/';   // a real content page, header and all
const PAGE_B = '/metronome/';            // the lightest page carrying the same header
const WIDTHS_A = [280, 320, 360, 390, 414, 480, 560, 720, 721, 860, 861, 1024, 1280, 1600];
const ROOTS_A = [16, 20, 24, 32];
const WIDTHS_B = [280, 320, 360, 390, 414, 480, 560, 720, 861, 1024, 1280];
const ROOTS_B = [16, 20, 24, 32];
const BPM = '240';                       // three digits: the widest the pill ever gets

const EDGE_CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/microsoft-edge',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
];

function findBrowser() {
  for (const p of EDGE_CANDIDATES) if (fs.existsSync(p)) return p;
  return null;
}

if (!fs.existsSync(path.join(SITE, 'index.html'))) {
  console.error('[check-header-shed] FAIL — _site is missing. Run `npm run build` first.');
  process.exit(1);
}
const browser = findBrowser();
if (!browser) {
  console.warn('[check-header-shed] SKIP — no Edge/Chrome binary found; layout cannot be measured here.');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// The measuring code, shared by both passes. Runs inside the harness page.
// ---------------------------------------------------------------------------
// Headless Chromium floors the WINDOW at ~492px, so narrow viewports have to be
// iframes; an iframe is only scriptable if it shares the parent's origin, which
// is why this is served over http rather than opened as a file:// URL.
const MEASURE = `
function measureCell(f, root, w) {
  var d = f.contentDocument, cw = f.contentWindow, de = d.documentElement;
  var row = d.querySelector('.site-header__inner');
  var vis = function (sel) {
    var el = d.querySelector(sel);
    if (!el) return null;
    var cs = cw.getComputedStyle(el);
    var r = el.getBoundingClientRect();
    return { present: cs.display !== 'none' && cs.visibility !== 'hidden',
             painted: cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0,
             w: +r.width.toFixed(1), sw: el.scrollWidth, cw: el.clientWidth };
  };
  var wm = vis('.site-logo__wm'), logo = vis('.site-logo');
  var out = {
    root: root, w: w,
    rowOverflow: row.scrollWidth - row.clientWidth,
    pageOverflow: de.scrollWidth - de.clientWidth,
    headerH: +d.querySelector('.site-header').getBoundingClientRect().height.toFixed(1),
    wmShown: !!(wm && wm.painted),
    // Clipping shows up on either box: the wordmark's own, or the link that
    // used to carry overflow:hidden around it.
    wmClipped: !!(wm && wm.painted && (wm.sw > wm.cw + 0.5 ||
                 (logo && logo.sw > logo.cw + 0.5))),
    sigShown: !!(vis('.clock-pill__sig') || {}).present,
    pillShown: !!(vis('.clock-pill') || {}).painted,
    navRowShown: !!(vis('.site-nav') || {}).painted,
    burgerShown: !!(vis('.nav-toggle') || {}).painted,
    themeInRow: !!(vis('.theme-toggle') || {}).painted,
    // The menu row lives inside a panel that is display:none until the menu is
    // opened, so "present" is its own computed display, not a rendered width.
    themeInMenu: !!(vis('#nav-theme-toggle') || {}).present,
    probeShown: !!(vis('#hdr-probe') || {}).painted,
    parts: ['.site-logo', '.theme-toggle', '.clock-pill', '.nav-toggle', '#hdr-probe']
      .map(function (s) { var v = vis(s); return s + '=' + (v && v.painted ? v.w : '-'); }).join(' '),
    // Stricter than "the row does not overflow", and it catches a different
    // failure: an item can sit past the right edge of the SCREEN while the row
    // box itself still measures clean — which is how the hamburger came to be
    // entirely off-screen at 280px the last time a control was added here.
    // No header item's right edge may pass documentElement.clientWidth.
    offRightEdge: ['.site-logo', '.site-logo__seal', '.site-logo__wm', '.theme-toggle',
      '.clock-pill', '.nav-toggle', '#hdr-probe'].filter(function (s) {
      var el = d.querySelector(s);
      if (!el) return false;
      var cs = cw.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      var r = el.getBoundingClientRect();
      return r.width > 0 && r.right > de.clientWidth + 0.5;
    }),
    shedClasses: (d.querySelector('.site-header').className || '')
      .replace('site-header', '').trim()
  };
  return out;
}
`;

// ---- Pass A: one load, then resize. -----------------------------------------
// Media queries AND container queries both re-evaluate on an iframe resize, so
// every cell is measurable from a single load. Nothing frame-driven is measured
// here on purpose: under --virtual-time-budget, requestAnimationFrame,
// ResizeObserver and window 'resize' do not fire at all in an iframe (verified),
// so this pass is a pure test of what the STYLESHEET does. Pass B covers the JS.
const HARNESS_A = `<!doctype html><meta charset="utf-8"><body style="margin:0"><div id="o">pending</div><script>
${MEASURE}
var WIDTHS=__W__, ROOTS=__R__, PAGE=__P__, BPM=__B__;
var f=document.createElement('iframe');
f.style.cssText='width:1280px;height:900px;border:0;position:absolute;left:-9000px;top:0';
document.body.appendChild(f);
var seeded=false, results=[];
f.onload=function(){
  if(!seeded){ seeded=true;
    try{ f.contentWindow.localStorage.setItem('dc_metro_bpm',BPM); }catch(e){}
    f.src=PAGE+'?harness=1'; return; }
  setTimeout(function(){
    try{
      var d=f.contentDocument, de=d.documentElement;
      ROOTS.forEach(function(r){
        de.style.fontSize=r+'px';
        WIDTHS.forEach(function(w){
          f.style.width=w+'px';
          void f.contentDocument.documentElement.offsetHeight;
          results.push(measureCell(f,r,w));
        });
      });
    }catch(err){ results=[{error:String((err&&err.stack)||err)}]; }
    document.getElementById('o').textContent=JSON.stringify(results);
  },250);
};
f.src=PAGE;
</script></body>`;

// ---- Pass B: one LOAD per cell, with the probe baked into the served HTML. ---
// The probe is inserted by the server, not by the harness, so the page loads
// with an extra header control exactly as it would if someone added one to
// base.njk — which means chrome.js's synchronous first fit runs against it.
// That matters: the resize path is rAF-throttled and rAF does not fire under
// virtual time, so a probe injected after load would never be seen.
const HARNESS_B = `<!doctype html><meta charset="utf-8"><body style="margin:0"><div id="o">pending</div><script>
${MEASURE}
var CELLS=__C__, PAGE=__P__, BPM=__B__;
var f=document.createElement('iframe');
f.style.cssText='width:1280px;height:900px;border:0;position:absolute;left:-9000px;top:0';
document.body.appendChild(f);
var i=-1, results=[], seeded=false;
function next(){
  i++;
  if(i>=CELLS.length){ document.getElementById('o').textContent=JSON.stringify(results); return; }
  f.style.width=CELLS[i][1]+'px';
  f.src=PAGE+'?harness=1&probe=1&root='+CELLS[i][0]+'&n='+i;
}
f.onload=function(){
  if(!seeded){ seeded=true;
    try{ f.contentWindow.localStorage.setItem('dc_metro_bpm',BPM); }catch(e){}
    next(); return; }
  setTimeout(function(){
    try{
      results.push(measureCell(f,CELLS[i][0],CELLS[i][1]));
    }catch(err){ results.push({root:CELLS[i][0],w:CELLS[i][1],error:String(err)}); }
    next();
  },120);
};
f.src=PAGE;
</script></body>`;

const cellsB = [];
for (const r of ROOTS_B) for (const w of WIDTHS_B) cellsB.push([r, w]);

const harnessA = HARNESS_A
  .replace('__W__', JSON.stringify(WIDTHS_A)).replace('__R__', JSON.stringify(ROOTS_A))
  .replace('__P__', JSON.stringify(PAGE_A)).replace('__B__', JSON.stringify(BPM));
const harnessB = HARNESS_B
  .replace('__C__', JSON.stringify(cellsB))
  .replace('__P__', JSON.stringify(PAGE_B)).replace('__B__', JSON.stringify(BPM));

// _site/dev/ is where the dev-server review pages live and is excluded from a
// production build, so it is the right home for a throwaway harness. It may not
// exist in a production _site; if this check created it, this check removes it.
const devDir = path.join(SITE, 'dev');
const devDirWasOurs = !fs.existsSync(devDir);
fs.mkdirSync(devDir, { recursive: true });
const pathA = path.join(devDir, '__header-shed-a.html');
const pathB = path.join(devDir, '__header-shed-b.html');
fs.writeFileSync(pathA, harnessA, 'utf8');
fs.writeFileSync(pathB, harnessB, 'utf8');

// The probe control and the root font size are injected by the server so they
// are present before any of the page's own script runs. A 44px square: the same
// footprint as the hamburger, which is the smallest a real control gets here.
const PROBE = `<script>(function(){
  var b=document.createElement('button');
  b.id='hdr-probe'; b.type='button'; b.setAttribute('aria-label','Probe control');
  b.style.cssText='width:44px;height:44px;flex-shrink:0;border:0;background:transparent;padding:0';
  var row=document.querySelector('.site-header__inner');
  if(row) row.appendChild(b);
})();</script>`;

const TYPES = { '.html': 'text/html;charset=utf-8', '.css': 'text/css;charset=utf-8',
  '.js': 'text/javascript;charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.wav': 'audio/wav', '.json': 'application/json', '.xml': 'application/xml' };

const server = http.createServer((req, res) => {
  const [rawPath, rawQuery] = req.url.split('?');
  const q = new URLSearchParams(rawQuery || '');
  let f = path.join(SITE, decodeURIComponent(rawPath));
  try { if (fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); } catch (e) { /* 404 below */ }
  fs.readFile(f, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    let body = buf;
    if (q.get('harness') === '1' && path.extname(f) === '.html') {
      // Everything the harness needs is injected into <head>, so it is in force
      // for the FIRST layout rather than applied afterwards. That ordering is
      // load-bearing and cost an hour to learn: with the scrollbar suppressed
      // only after load, the page laid out 15px narrower than the harness then
      // measured it at, so the row shed one step too early during load, and the
      // 15px that came back afterwards produced an overflow that nothing was
      // left to respond to. The harness was measuring a layout that had never
      // existed.
      //   - scrollbars off: a phone uses overlay scrollbars, but this iframe has
      //     a classic 15px one, which would otherwise mask 15px of real overflow
      //   - the root font size, so the container queries see it from the start
      let head = '<style>html{scrollbar-width:none}html::-webkit-scrollbar{display:none}';
      if (q.get('root')) head += `html{font-size:${Number(q.get('root'))}px}`;
      head += '</style>';
      let html = buf.toString('utf8').replace('</head>', head + '</head>');
      // The probe is a classic inline script, which runs during parsing and so
      // before every deferred script including chrome.js — exactly as a control
      // added to base.njk would be present before any of the page's JS runs.
      if (q.get('probe') === '1') html = html.replace('</body>', PROBE + '</body>');
      body = Buffer.from(html, 'utf8');
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    res.end(body);
  });
});

function run(port, harnessName) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-shed-'));
  return new Promise((resolve, reject) => {
    // spawn, NOT execFileSync: the static server lives in this same process, so
    // blocking the event loop would leave the browser waiting on a request that
    // can never be answered.
    const child = spawn(browser, [
      '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--user-data-dir=' + profile, '--timeout=90000', '--virtual-time-budget=85000',
      '--window-size=1700,900', '--dump-dom',
      `http://127.0.0.1:${port}/dev/${harnessName}`,
    ], { stdio: ['ignore', 'pipe', 'ignore'] });
    let buf = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', d => { buf += d; });
    child.on('error', reject);
    child.on('close', () => {
      try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
      resolve(buf);
    });
  });
}

function parse(dom, label) {
  const m = dom.match(/<div id="o">([\s\S]*?)<\/div>/);
  if (!m || m[1].trim() === 'pending') {
    console.error(`[check-header-shed] FAIL — ${label} produced no measurements.`);
    process.exit(1);
  }
  let rows;
  try {
    rows = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
  } catch (e) {
    console.error(`[check-header-shed] FAIL — unreadable ${label} output: ${e.message}`);
    process.exit(1);
  }
  if (rows[0] && rows[0].error) {
    console.error(`[check-header-shed] FAIL — ${label} threw: ${rows[0].error}`);
    process.exit(1);
  }
  return rows;
}

function audit(rows, label, expectProbe) {
  const fails = [];
  for (const r of rows) {
    const at = `${label} ${r.w}px @${r.root}px root`;
    if (r.error) { fails.push(`${at} — harness error: ${r.error}`); continue; }
    if (r.rowOverflow > 0) {
      fails.push(`${at} — the header row overflows its box by ${r.rowOverflow}px ` +
                 `(shed classes: "${r.shedClasses || 'none'}"; parts: ${r.parts})`);
    }
    if (r.offRightEdge && r.offRightEdge.length) {
      fails.push(`${at} — header item(s) past the right edge of the screen: ${r.offRightEdge.join(', ')} ` +
                 `(viewport ${r.w}px). A control the reader cannot reach is not shed, it is stranded.`);
    }
    if (r.wmClipped) {
      fails.push(`${at} — the wordmark is CLIPPED, not shed. This is BL-092: the site's ` +
                 `name renders as a shorter different word with no sign it was cut.`);
    }
    if (!r.pillShown) fails.push(`${at} — the clock pill is gone; it is the only route to the metronome`);
    if (!r.navRowShown && !r.burgerShown) fails.push(`${at} — no navigation at all: neither the nav row nor the hamburger`);
    const themeCount = (r.themeInRow ? 1 : 0) + (r.themeInMenu ? 1 : 0);
    if (themeCount !== 1) {
      fails.push(`${at} — ${themeCount} theme controls (row: ${r.themeInRow}, menu: ${r.themeInMenu}); ` +
                 `there must be exactly one at every width`);
    }
    if (r.themeInMenu && !r.burgerShown) {
      fails.push(`${at} — the theme control moved into the menu but the hamburger that opens it is not rendered, ` +
                 `so the control is unreachable. A shed control must still have a route to it.`);
    }
    // The ladder's order, not just its outcome. Each step may only be taken
    // once every cheaper step above it has been.
    if (!r.wmShown && r.sigShown) {
      fails.push(`${at} — out of order: the wordmark was shed while the pill still shows "· 4/4". ` +
                 `The meter readout is cheaper than the site's name and goes first.`);
    }
    if (!r.themeInRow && r.wmShown) {
      fails.push(`${at} — out of order: the theme toggle left the row while the wordmark is still shown. ` +
                 `The wordmark goes first.`);
    }
    if (expectProbe && !r.probeShown) fails.push(`${at} — the probe control was not rendered; the pass is not testing what it claims`);
  }
  return fails;
}

server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  let fails = [];
  let rowsA, rowsB;
  try {
    rowsA = parse(await run(port, '__header-shed-a.html'), 'pass A (the ladder)');
    rowsB = parse(await run(port, '__header-shed-b.html'), 'pass B (the reserve)');
  } catch (e) {
    cleanup();
    console.error('[check-header-shed] FAIL — could not run the browser: ' + e.message);
    process.exit(1);
  }
  cleanup();

  if (rowsA.length !== WIDTHS_A.length * ROOTS_A.length) {
    console.error(`[check-header-shed] FAIL — pass A: expected ${WIDTHS_A.length * ROOTS_A.length} cells, got ${rowsA.length}.`);
    process.exit(1);
  }
  if (rowsB.length !== cellsB.length) {
    console.error(`[check-header-shed] FAIL — pass B: expected ${cellsB.length} cells, got ${rowsB.length}.`);
    process.exit(1);
  }

  fails = fails.concat(audit(rowsA, 'ladder', false), audit(rowsB, 'reserve', true));

  if (fails.length) {
    console.error('[check-header-shed] FAIL:');
    fails.forEach(f => console.error('  ' + f));
    console.error(`\n  The ladder lives in style.css under HEADER SHEDDING LADDER, and its thresholds are
  the row's own parts summed — not numbers anyone chose. If an item was added to the
  header row, re-derive them: measure each part at a 16px and a 32px root, fit
  "Apx + Brem" through the two, and add the new part to every threshold it appears in.
  Do NOT answer this with another media query: em and rem inside @media resolve
  against the browser's default font size, never against html{font-size}, which is
  exactly why the row broke at 150% text in the first place.`);
    process.exit(1);
  }

  // A readable summary of what the ladder actually did, so a reader of the log
  // can see the order rather than take it on trust.
  const state = r => [r.navRowShown ? 'nav' : 'menu', r.wmShown ? 'wordmark' : '·',
    r.sigShown ? 'meter' : '·', r.themeInRow ? 'theme' : 'theme→menu'].join(' ');
  const byRoot = {};
  for (const r of rowsA) (byRoot[r.root] = byRoot[r.root] || []).push(r);
  console.log(`[check-header-shed] OK — ${rowsA.length} ladder cells + ${rowsB.length} reserve cells, ` +
              `no overflow, no clipped wordmark, one theme control everywhere.`);
  for (const root of ROOTS_A) {
    const seen = [];
    for (const r of byRoot[root]) {
      const s = state(r);
      if (!seen.length || seen[seen.length - 1].s !== s) seen.push({ from: r.w, s: s });
    }
    console.log(`  @${root}px root: ` + seen.map(x => `${x.from}px+ [${x.s}]`).join('  '));
  }
  const worstA = rowsA.reduce((a, b) => (b.rowOverflow > a.rowOverflow ? b : a));
  const worstB = rowsB.reduce((a, b) => (b.rowOverflow > a.rowOverflow ? b : a));
  console.log(`  tightest row: ${worstA.rowOverflow}px over at ${worstA.w}px/@${worstA.root} (ladder), ` +
              `${worstB.rowOverflow}px over at ${worstB.w}px/@${worstB.root} (with a 44px probe control added)`);
  process.exit(0);
});

function cleanup() {
  try { fs.unlinkSync(pathA); } catch (e) {}
  try { fs.unlinkSync(pathB); } catch (e) {}
  if (devDirWasOurs) { try { fs.rmdirSync(devDir); } catch (e) {} }
  try { server.close(); } catch (e) {}
}
