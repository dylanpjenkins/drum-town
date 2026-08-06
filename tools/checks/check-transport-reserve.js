#!/usr/bin/env node
// check-transport-reserve.js — PKG-4 / BL-036's structural guarantee.
//
// The transport dock is `position: fixed` at the bottom of the viewport, and
// the only thing keeping it off the page's last exercise, graduation criteria
// and footer is the body reserve:
//
//   html.transport-open body { padding-bottom: calc(var(--transport-h) + 12px) }
//
// That reserve is a CONSTANT. The dock's rendered height is not — it depends on
// the breakpoint, the control widths, and (before this check existed) the beat
// count, which the user changes by picking a time signature. Two real bugs shipped
// past code review and eyeballed screenshots here:
//
//   1. --transport-h was 120px at <=720px while the dock rendered 129px, because
//      the zero-height flex break element takes a line of its own and the row box
//      therefore pays TWO row-gaps. Clearance was 3px.
//   2. .transport__beats used `flex-basis: auto`, so 7/8 on a 320px phone widened
//      row 1 past the viewport, wrapped it, and took the dock to 181px against a
//      140px reserve — a 41px overlap.
//
// Neither is visible in a 1280px screenshot and neither shows up in the DOM. Only
// layout catches them, so this check drives a real browser: it serves _site over
// loopback, measures the dock and the reserve at every interesting width and time
// signature, and fails if the reserve does not clear the dock.
//
// Exits 0 on pass, 1 on fail, and 0 with a loud SKIP if Edge is not installed
// (the metric gates still run on such machines; this one simply cannot).

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SITE = path.join(ROOT, '_site');
const PAGE = '/lessons/paradiddle/';          // long page, has the footer + where-next
const WIDTHS = [280, 320, 360, 390, 414, 480, 720, 721, 900, 1024, 1280, 1600];
const SIGS = [2, 4, 7];                        // 7/8 is the widest dot row
const MIN_CLEARANCE = 4;                       // px of daylight required

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
  console.error('[check-transport-reserve] FAIL — _site is missing. Run `npm run build` first.');
  process.exit(1);
}
const browser = findBrowser();
if (!browser) {
  console.warn('[check-transport-reserve] SKIP — no Edge/Chrome binary found; layout cannot be measured here.');
  process.exit(0);
}

// ---- the measuring page (written into _site so the iframe is same-origin) ----
// Headless Chromium floors the WINDOW at ~492px, so narrow viewports have to be
// iframes; an iframe is only scriptable if it shares the parent's origin, which
// is why this is served over http rather than opened as a file:// URL.
// ONE load, then resize. Media queries re-evaluate on an iframe resize, so
// every breakpoint is measurable without reloading — which keeps the whole
// harness synchronous after a single load event and removes the sequencing
// that made an earlier reload-per-width version hang under virtual time.
const HARNESS = `<!doctype html><meta charset="utf-8"><body style="margin:0"><div id="o">pending</div><script>
var WIDTHS=__WIDTHS__, SIGS=__SIGS__, PAGE=__PAGE__;
var f=document.createElement('iframe');
f.style.cssText='width:1280px;height:800px;border:0;position:absolute;left:-9000px;top:0';
f.src=PAGE;
document.body.appendChild(f);
f.onload=function(){ setTimeout(function(){
  var results=[];
  try{
    var d=f.contentDocument, cw=f.contentWindow;
    // Phones use overlay scrollbars; the harness iframe has a classic 15px one,
    // which would mask ~15px of real horizontal overflow.
    var kill=d.createElement('style');
    kill.textContent='html{scrollbar-width:none}html::-webkit-scrollbar{display:none}';
    d.head.appendChild(kill);
    var t=d.querySelector('.transport'), ts=d.getElementById('metronome-timesig');
    // open the dock the way a visitor does, by tapping the pill
    if (t.classList.contains('is-collapsed')) d.getElementById('metronome-pill').click();
    WIDTHS.forEach(function(w){
      f.style.width=w+'px';
      void f.contentDocument.documentElement.offsetHeight;   // force reflow at the new width
      SIGS.forEach(function(sig){
        ts.value=String(sig);
        ts.dispatchEvent(new cw.Event('change',{bubbles:true}));
        void t.offsetHeight;
        var tr=t.getBoundingClientRect();
        var dock=tr.height;
        var pad=parseFloat(cw.getComputedStyle(d.body).paddingBottom);
        var tok=parseFloat(cw.getComputedStyle(d.documentElement).getPropertyValue('--transport-h'));
        var de=d.documentElement;

        // Anything anchored to the VIEWPORT ignores the body reserve entirely.
        // The sticky curriculum sidebar did, and buried its own last entry.
        var occluders=[];
        var els=d.body.querySelectorAll('*');
        for (var i=0;i<els.length;i++){
          var e=els[i];
          if (e===t || t.contains(e)) continue;
          if (e.closest('.site-header')) continue;          // header + nav panel are lifted above the dock on purpose
          var pos=cw.getComputedStyle(e).position;
          if (pos!=='fixed' && pos!=='sticky') continue;
          var r=e.getBoundingClientRect();
          if (r.width<=0 || r.height<=0) continue;
          if (r.bottom>tr.top+1 && r.top<tr.bottom && r.right>tr.left && r.left<tr.right) {
            occluders.push((e.className||e.tagName)+' bottom='+r.bottom.toFixed(0)+' vs dockTop='+tr.top.toFixed(0));
          }
        }

        results.push({w:w,sig:sig,dock:+dock.toFixed(1),pad:pad,token:tok,
                      clearance:+(pad-dock).toFixed(1),
                      scrollW:de.scrollWidth, clientW:de.clientWidth,
                      overflowX:de.scrollWidth-de.clientWidth,
                      occluders:occluders,
                      open:!t.classList.contains('is-collapsed'),
                      reserved:de.classList.contains('transport-open')});
      });
    });
  }catch(err){ results=[{error:String((err&&err.stack)||err)}]; }
  document.getElementById('o').textContent=JSON.stringify(results);
},200); };
</script></body>`
  .replace('__WIDTHS__', JSON.stringify(WIDTHS))
  .replace('__SIGS__', JSON.stringify(SIGS))
  .replace('__PAGE__', JSON.stringify(PAGE));

const harnessName = '__transport-reserve-check.html';
const harnessPath = path.join(SITE, harnessName);
fs.writeFileSync(harnessPath, HARNESS, 'utf8');

const TYPES = { '.html': 'text/html;charset=utf-8', '.css': 'text/css;charset=utf-8',
  '.js': 'text/javascript;charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.wav': 'audio/wav', '.json': 'application/json', '.xml': 'application/xml' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
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
  try { server.close(); } catch (e) {}
}

server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-reserve-'));
  let dom = '';
  try {
    // spawn, NOT execFileSync: the static server lives in this same process, so
    // blocking the event loop would leave the browser waiting on a request that
    // can never be answered — the page would sit at "pending" forever.
    dom = await new Promise((resolve, reject) => {
      const child = spawn(browser, [
        '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
        '--user-data-dir=' + profile, '--timeout=45000', '--virtual-time-budget=40000',
        '--window-size=1700,900', '--dump-dom',
        `http://127.0.0.1:${port}/${harnessName}`,
      ], { stdio: ['ignore', 'pipe', 'ignore'] });
      let buf = '';
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', d => { buf += d; });
      child.on('error', reject);
      child.on('close', () => resolve(buf));
    });
  } catch (e) {
    cleanup();
    console.error('[check-transport-reserve] FAIL — could not run the browser: ' + e.message);
    process.exit(1);
  } finally {
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  }
  cleanup();

  const m = dom.match(/<div id="o">([\s\S]*?)<\/div>/);
  if (!m || m[1].trim() === 'pending') {
    console.error('[check-transport-reserve] FAIL — the harness produced no measurements.');
    process.exit(1);
  }
  let rows;
  try {
    rows = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
  } catch (e) {
    console.error('[check-transport-reserve] FAIL — unreadable harness output: ' + e.message);
    process.exit(1);
  }
  if (rows.length !== WIDTHS.length * SIGS.length) {
    console.error(`[check-transport-reserve] FAIL — expected ${WIDTHS.length * SIGS.length} measurements, got ${rows.length}.`);
    process.exit(1);
  }

  const bad = [];
  const overflow = [];
  const occluded = [];
  for (const r of rows) {
    if (!r.open || !r.reserved) bad.push(`${r.w}px ${r.sig}/x — dock did not open (open=${r.open}, html.transport-open=${r.reserved})`);
    else if (r.clearance < MIN_CLEARANCE) bad.push(`${r.w}px ${r.sig}/x — dock ${r.dock}px vs reserve ${r.pad}px = ${r.clearance}px clearance (token --transport-h: ${r.token}px)`);
    if (r.overflowX > 0) overflow.push(`${r.w}px ${r.sig}/x — scrollWidth ${r.scrollW} vs clientWidth ${r.clientW} = ${r.overflowX}px of sideways scroll`);
    if (r.occluders && r.occluders.length) occluded.push(`${r.w}px ${r.sig}/x — ${r.occluders.join(' | ')}`);
  }

  if (bad.length) {
    console.error('[check-transport-reserve] FAIL — the body reserve does not clear the dock:');
    bad.forEach(b => console.error('  ' + b));
    console.error(`\n  The reserve is calc(var(--transport-h) + 12px). Either --transport-h undershoots the\n  dock's real height at that breakpoint, or a control is wrapping the row onto an extra\n  line. Measure, then fix the token or stop the wrap — do not shrink MIN_CLEARANCE.`);
    process.exit(1);
  }
  if (occluded.length) {
    console.error('[check-transport-reserve] FAIL — a viewport-anchored element runs under the dock:');
    occluded.forEach(b => console.error('  ' + b));
    console.error(`\n  The body reserve only moves things in NORMAL FLOW. Anything position:fixed or\n  position:sticky is sized against the viewport and slides straight past it — that is\n  how the curriculum sidebar came to bury its own last entry under the dock. Shorten\n  the offending box by var(--transport-h) while html.transport-open is set.`);
    process.exit(1);
  }
  if (overflow.length) {
    console.error('[check-transport-reserve] FAIL — the page scrolls sideways:');
    overflow.forEach(b => console.error('  ' + b));
    console.error(`\n  320px is the normative reflow width of WCAG 2.1 SC 1.4.10, and it is also what 400%\n  browser zoom produces in a 1280px window. The header row (logo, theme toggle, clock\n  pill, hamburger) is the usual culprit: every item in it is flex-shrink: 0, so something\n  has to be dropped rather than squeezed.`);
    process.exit(1);
  }

  const worst = rows.reduce((a, b) => (b.clearance < a.clearance ? b : a));
  const heights = [...new Set(rows.map(r => `${r.dock}px`))].join(', ');
  console.log(`[check-transport-reserve] OK — ${rows.length} measurements across ${WIDTHS.length} widths x ${SIGS.length} time signatures.`);
  console.log(`  dock heights seen: ${heights} (constant per breakpoint, independent of beat count)`);
  console.log(`  tightest clearance: ${worst.clearance}px at ${worst.w}px in ${worst.sig}/x`);
  process.exit(0);
});
