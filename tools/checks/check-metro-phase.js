#!/usr/bin/env node
// check-metro-phase.js — BL-101. The accent has to land on a bar boundary.
//
// The dock's beat row exists so a reader can see where "1" is. Changing the
// meter while the click runs used to move the bar length without moving the
// count: scheduleAhead accents `beatIndex % beatsPerBar` and setMeter assigned
// beatsPerBar while leaving beatIndex alone, so the next downbeat landed
// wherever the old counter happened to fall. Measured on the built site before
// the fix: 2/4 to 7/8 waited SIX clicks for its first "1", 5/4 to 3/4 at 30 BPM
// waited four seconds, and 6/8 to 4/4 put the accent two clicks late. The dot
// row showed the same lie, and twice went one better: a click already committed
// under the old meter fired into a row too short to hold its index, so the pill
// lamp pulsed alone over a dark row for 85ms, three runs out of three, measured
// at 5ms resolution. The ceiling is 90ms, because that is the setTimeout that
// clears the pulse. An earlier draft of this line said 88-96ms; that was read at
// 8ms resolution, and 96ms was never possible.
//
// None of that is visible in markup and none of it is visible in a screenshot.
// It is a property of a running clock, so this check runs one: it serves _site
// over loopback, loads a real built page in a real browser, and drives the real
// metronome.js through 13 control changes across 10 scenarios, reading the
// accent out of the oscillator frequency and the beat out of the dot classes.
//
// WHAT IS REAL AND WHAT IS NOT. The page, the script, the DOM, the classList,
// setMeter, scheduleAhead, startVisualPulse and flashBeat are all the shipped
// article. Two globals are swapped on the iframe's window before the first play
// press, and metronome.js resolves both at CALL time so neither needs a source
// change:
//
//   * AudioContext, because headless Chromium freezes the audio clock the moment
//     --virtual-time-budget is on, and dumps the DOM at load without it. The
//     replacement is a clock this file steps by hand. click() still runs
//     unmodified, and its oscillator frequency (1500 accented, 1000 not) IS the
//     audio assertion.
//   * requestAnimationFrame, because headless virtual time barely produces
//     frames, so the real visual-pulse loop would never run. It is routed
//     through a 16ms timer.
//
// Both swaps were measured rather than assumed, and the probe is reproducible:
// open a built page in an iframe under --virtual-time-budget, construct a real
// AudioContext, resume it, and after 1500ms compare its currentTime against
// performance.now while counting rAF callbacks. Two runs gave an audio clock
// advance of 0.0000s against a performance.now advance of 1500.0ms and 1499.9ms,
// with 0 and 1 rAF callbacks where 60Hz would give about 90. Without the virtual
// time budget --dump-dom fires at load and the page is still "pending". If those
// numbers ever stop reproducing, the swaps are the first thing to re-justify.
//
// DT is 8ms and must stay above 4ms: Chromium clamps a self-rescheduling
// setTimeout chain to 4ms after five levels of nesting, so a smaller DT would
// make the fake clock run slower than virtual wall time and silently halve every
// duration this file reports.
//
// THIS RUN IS NOT BIT-IDENTICAL, and an earlier version of this comment claimed
// it was. The stepped clock is deterministic; the number of clicks that fit
// before the run is torn down is not, because the driver, the 200ms scheduler
// interval and the 16ms pulse loop interleave under virtual time. Six
// consecutive unmutated runs of THIS revision, on the build these comments were
// written against, produced 218, 218, 218, 218, 217 and 218 clicks; earlier
// revisions of the same scenarios ranged 210 to 218. Treat the spread, not the
// value, as the thing to preserve.
//
// So no property below may key off an absolute click total. They are all
// relative to the run's own clicks, and the flash count is measured against a
// window ending at the scenario's own end time (see `firable` and
// OBSERVE_MARGIN), never against anything the DOM did. Two fixed floors are
// deliberate exceptions, and they are sanity rails rather than properties: at
// least 5 flashes must match a click, and at most 1 may match none. They exist
// so a harness that measured nothing at all cannot pass silently.
//
// So this check does NOT prove the browser paints, that rAF fires, that the CSS
// makes .is-active visible, or that a real AudioContext resumes under an
// autoplay policy. It proves the phase arithmetic and the DOM the reader reads.
//
// WHAT IT ASSERTS, all derived from the run rather than restated:
//   1. every session's first click is accented and lights dot 0 (a fresh start
//      is always on a downbeat);
//   2. before any change, dot index == click index % old meter, and accents fall
//      exactly on index 0;
//   3. the first click scheduled AFTER a meter change is accented;
//   4. from there on, accents are exactly `to` clicks apart and the dot indices
//      run 0,1,..,to-1 and repeat;
//   5. a click already committed when the meter changed never lights dot 0
//      unless it was itself accented (a clamp may not invent a downbeat);
//   6. every flash lights exactly one dot AND the pill, with is-downbeat-active
//      on both or neither, and no sampled state ever has them disagreeing;
//   7. every flash's downbeat class matches the accent of the click at that time;
//   8. re-setting the SAME meter does not reset the phase — adoptTempo calls
//      setMeter on all 832 exercise tempo buttons, most naming a meter the dock
//      is often already in;
//   9. a tempo change does not reset the phase, AND it actually reaches the
//      running click: consecutive click spacing equals 60/bpm throughout, so the
//      run cannot pass by the tempo simply doing nothing;
//  10. the committed-ahead window stays inside MAX_WINDOW_MS, a budget declared
//      HERE rather than read from the code under test, and SCHEDULE_AHEAD is
//      asserted against the same budget so widening it fails outright.
//
// KNOWN GREEN THAT SHOULD NOT BE — read this before trusting a pass:
//   * The dock offers meters 2..7 only, so 8..12 are never exercised here. They
//     are unreachable through the select, but readInt(TS_KEY, .., 2, 12) and the
//     pageshow restore would both accept a stored 8..12 without an option to
//     match. Nothing writes those values today.
//   * Denominators are ignored throughout, exactly as the dock ignores them:
//     6/8 is counted as six clicks. That is metronome.js's own model, so this
//     check cannot notice if the model itself is wrong.
//   * Session start is covered only via the play button, not via a bfcache
//     restore, which cannot be driven from a same-origin iframe.
//   * Timing tolerance: a flash is matched to the nearest click within 100ms. A
//     regression that delayed every flash by a constant under that would pass.
//   * The clamp's CHOICE of dot is not asserted, only its invariants: in range,
//     row and pill together, and never lighting dot 0 for an unaccented click.
//     Clamping to the second-to-last dot instead of the last satisfies all three
//     and is caught only incidentally, by the post-change index rule, and only
//     when the leftover happens to land after the new downbeat.
//   * SEVERAL MUTANTS ARE CAUGHT WITH THE WRONG MESSAGE. Pruning beatTimes
//     early, narrowing the 0.08s fire window, or stopping the flashes outright
//     all trip the `firable` flash-count rule and report "the beat row is not
//     following the click", which is true but sends a maintainer after a visual
//     bug when the cause is in the scheduler. Read the scenario, not just the
//     sentence.
//   * The 90ms pulse duration is the one timing constant here that is neither
//     read out of the built script nor asserted against a budget, unlike
//     SCHEDULE_AHEAD and the start lookahead. Shortening it to 70ms is a control
//     in the mutation audit and stays green, correctly; lengthening it past a
//     beat would overlap two flashes and trip the one-dot-at-a-time rule, but
//     only incidentally.
//   * The armed/bfcache path, volume, persistence and collapse are untested, and
//     so is any meter change made while NO session is running.
//
// Exits 0 on pass, 1 on fail, and 0 with a loud SKIP if Edge is not installed
// (the metric gates still run on such machines; this one cannot).

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SITE = path.join(ROOT, '_site');
const PAGE = '/metronome/';
const DT = 0.008;            // audio seconds per driver step, scheduled DT*1000 ms
                             // apart so the fake clock tracks virtual wall time 1:1
const MATCH_WINDOW = 0.1;    // s: how far a flash may sit from the click it shows

// The budget for how long the OUTGOING accent pattern may still be audible after
// a reader changes the meter, declared here on purpose. Bounding the measured
// window by the code's own SCHEDULE_AHEAD would make this assertion circular:
// widening the scheduler would widen the bound with it and could never fail.
// 500ms is roughly two beats at the dock's fastest tempo (240 BPM) and is the
// most stale pattern a reader should ever hear from an explicit control press.
const MAX_WINDOW_MS = 500;

// Same reasoning for start(): the harness READS the lookahead so it cannot
// drift from the source, which means it must also be BOUNDED here or a widened
// lookahead would move the harness's expectation with it and never fail.
// Pressing play should make a sound now; 150ms is the outside edge of a press
// still reading as instantaneous.
const MAX_START_LOOKAHEAD_MS = 150;

// How close to the end of a scenario a click may be and still be expected to
// have lit the row. A click is only countable once the pulse loop has had a
// frame to notice it (the harness drives rAF at 16ms) and the driver has had a
// step to sample it (DT, 8ms), so the floor is ~24ms; 50ms is a little over
// twice that.
//
// Swept over 50 unmutated scenario runs and the clean-stop mutant: every value
// from 20ms to 200ms selects the SAME set of clicks, all green unmutated and all
// catching the mutant in 10/10 scenarios. That is not luck. The harness stops
// 0.2s after the final beat of a scenario and `until` is a whole number of
// beats, so the last click sits exactly 200ms inside the end and nothing else
// lands in between. The rule is therefore insensitive to this constant across an
// order of magnitude, and 50ms sits in the middle of that plateau rather than at
// either edge of it.
const OBSERVE_MARGIN = 0.05;

// `from`/`to` must be options the dock actually offers (2..7); a value with no
// option is refused by setMeter and the scenario would silently test nothing,
// which is why dotsAtStart and the post-change row size are both asserted.
const SCENARIOS = [
  { name: 'shrink 6/8 -> 4/4 mid-bar',        bpm: 100, from: 6, to: 4, changes: [4.5],  until: 16 },
  { name: 'widest shrink 7/8 -> 2/4 mid-bar', bpm: 240, from: 7, to: 2, changes: [4.5],  until: 22 },
  { name: 'widest grow 2/4 -> 7/8 mid-bar',   bpm: 240, from: 2, to: 7, changes: [5.5],  until: 28 },
  { name: 'change ON the downbeat',           bpm: 100, from: 4, to: 3, changes: [4.0],  until: 16 },
  { name: 'change just BEFORE a downbeat',    bpm: 100, from: 4, to: 3, changes: [3.9],  until: 16 },
  // 30ms after a beat sounds is inside that beat's 90ms flash and outside the
  // <=16ms the pulse loop takes to notice it, so renderBeats wipes the row
  // mid-pulse. This is the scenario that catches the pill lamp being left lit
  // over an empty row.
  { name: 'change INSIDE a flash',            bpm: 100, from: 5, to: 3, changes: [4.05], until: 16 },
  { name: 'rapid repeated changes',           bpm: 240, from: 4, to: 5, tos: [3, 7, 2, 5],
    changes: [4.0, 4.3, 4.6, 4.9], until: 30 },
  { name: 'slow click, shrink 5/4 -> 3/4',    bpm: 30,  from: 5, to: 3, changes: [3.4],  until: 9 },
  { name: 'SAME meter re-set keeps phase',    bpm: 100, from: 4, to: 4, changes: [4.5],  until: 18, noReset: true },
  { name: 'tempo change keeps phase',         bpm: 100, from: 4, to: 4, changes: [],     until: 18, noReset: true,
    bpmChange: { at: 4.5, bpm: 160 } },
];

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

function fail(lines) {
  console.error('[check-metro-phase] FAIL:');
  (Array.isArray(lines) ? lines : [lines]).slice(0, 60).forEach(l => console.error('  ' + l));
  process.exit(1);
}

if (!fs.existsSync(path.join(SITE, 'index.html'))) {
  fail('_site is missing. Run `npm run build` first.');
}

// ---- constants read out of the BUILT script ---------------------------------
// Not to bound anything (MAX_WINDOW_MS does that), but so the report names the
// scheduler's real numbers, and so a rename is a loud failure rather than a
// silently weakened check. START_LOOKAHEAD is read rather than restated for the
// same reason: the harness needs the offset of a session's first click, and a
// second copy of 0.06 living here would drift the moment metronome.js changed.
const builtJs = path.join(SITE, 'assets', 'js', 'metronome.js');
if (!fs.existsSync(builtJs)) fail('_site/assets/js/metronome.js is missing; the dock ships no behaviour.');
const builtSrc = fs.readFileSync(builtJs, 'utf8');
const schedMatch = /SCHEDULE_AHEAD\s*=\s*([\d.]+)/.exec(builtSrc);
if (!schedMatch) {
  fail('SCHEDULE_AHEAD is not in the built metronome.js; the scheduler was renamed and this check can no longer report the window.');
}
const SCHEDULE_AHEAD = Number(schedMatch[1]);
const lookMatch = /lookahead\s*=\s*([\d.]+)/.exec(builtSrc);
if (!lookMatch) {
  fail('the start() lookahead is not in the built metronome.js; the harness cannot locate a session\'s first click.');
}
const START_LOOKAHEAD = Number(lookMatch[1]);

// The scheduler itself must sit inside the audible budget. Asserted here, not
// against the measured window, so raising SCHEDULE_AHEAD fails with the reason
// rather than quietly raising the bound it is measured against.
if (SCHEDULE_AHEAD * 1000 > MAX_WINDOW_MS) {
  fail(`SCHEDULE_AHEAD is ${SCHEDULE_AHEAD * 1000}ms, past the ${MAX_WINDOW_MS}ms budget for how long the outgoing accent pattern may stay audible after a meter change. Every click committed inside that window keeps the old accent.`);
}
if (START_LOOKAHEAD * 1000 > MAX_START_LOOKAHEAD_MS) {
  fail(`start() waits ${START_LOOKAHEAD * 1000}ms before its first click, past the ${MAX_START_LOOKAHEAD_MS}ms budget. Pressing play would read as laggy — and because the harness reads this value, a silent widening would move its expectation instead of failing.`);
}

const browser = findBrowser();
if (!browser) {
  console.warn('[check-metro-phase] SKIP — no Edge/Chrome binary found; a running clock cannot be measured here.');
  process.exit(0);
}

// ---- the harness ------------------------------------------------------------
const HARNESS = `<!doctype html><meta charset="utf-8"><body style="margin:0"><div id="o">pending</div><script>
var SCENARIOS = __SCENARIOS__, DT = __DT__, START_LOOKAHEAD = __LOOKAHEAD__;
var out = { scenarios: [], meta: {} };
var f = document.createElement('iframe');
f.style.cssText = 'width:1280px;height:900px;border:0;position:absolute;left:-9000px;top:0';
f.src = __PAGE__;
document.body.appendChild(f);
function done(o) { document.getElementById('o').textContent = JSON.stringify(o); }
f.onload = function () { setTimeout(function () {
  try {
    var d = f.contentDocument, cw = f.contentWindow;

    var T = 0, voices = [];
    function FakeParam() {}
    FakeParam.prototype.setValueAtTime = function () { return this; };
    FakeParam.prototype.exponentialRampToValueAtTime = function () { return this; };
    function FakeCtx() {
      this.state = 'running';
      this.destination = { __dest: true };
      Object.defineProperty(this, 'currentTime', { get: function () { return T; } });
    }
    FakeCtx.prototype.resume = function () { return Promise.resolve(); };
    FakeCtx.prototype.createGain = function () { return { gain: new FakeParam(), connect: function (x) { return x; } }; };
    FakeCtx.prototype.createOscillator = function () {
      var v = { type: '', frequency: { value: 0 } };
      v.connect = function (x) { return x; };
      v.start = function (t) { voices.push({ t: +t.toFixed(4), freq: v.frequency.value }); };
      v.stop = function () {};
      return v;
    };
    cw.AudioContext = FakeCtx; cw.webkitAudioContext = FakeCtx;
    cw.requestAnimationFrame = function (fn) { return cw.setTimeout(function () { fn(T * 1000); }, 16); };
    cw.cancelAnimationFrame = function (id) { cw.clearTimeout(id); };

    var rootEl  = d.getElementById('site-metronome');
    var pill    = d.getElementById('metronome-pill');
    var pillDot = pill ? pill.querySelector('.clock-pill__dot') : null;
    var toggle  = d.getElementById('metronome-toggle');
    var tsSel   = d.getElementById('metronome-timesig');
    var bpmIn   = d.getElementById('metronome-bpm');
    var beatsBx = d.getElementById('metronome-beats');
    if (!rootEl || !pill || !pillDot || !toggle || !tsSel || !bpmIn || !beatsBx) {
      return done({ error: 'dock markup missing (root/pill/pillDot/toggle/select/bpm/beats): ' +
        [!!rootEl, !!pill, !!pillDot, !!toggle, !!tsSel, !!bpmIn, !!beatsBx].join(',') });
    }
    out.meta.options = [].slice.call(tsSel.options).map(function (o) { return Number(o.value); });
    if (rootEl.classList.contains('is-collapsed')) pill.click();

    function setSel(v) { tsSel.value = String(v); tsSel.dispatchEvent(new cw.Event('change', { bubbles: true })); }
    function setBpm(v) { bpmIn.value = String(v); bpmIn.dispatchEvent(new cw.Event('change', { bubbles: true })); }

    var events = [], lastKey = null;
    function sample(mark) {
      var dots = beatsBx.querySelectorAll('.transport__beat');
      var n = dots.length, lit = [], down = [];
      for (var i = 0; i < n; i++) {
        if (dots[i].classList.contains('is-active')) lit.push(i);
        if (dots[i].classList.contains('is-downbeat-active')) down.push(i);
      }
      var pa = pillDot.classList.contains('is-active');
      var pd = pillDot.classList.contains('is-downbeat-active');
      if (mark) events.push({ t: +T.toFixed(3), mark: mark, n: n, vcount: voices.length });
      var key = n + '|' + lit + '|' + down + '|' + pa + '|' + pd;
      if (key !== lastKey) {
        events.push({ t: +T.toFixed(3), n: n, lit: lit, down: down, pill: pa, pillDown: pd });
        lastKey = key;
      }
    }

    var si = 0;
    function runScenario() {
      if (si >= SCENARIOS.length) return done(out);
      var S = SCENARIOS[si];
      events = []; lastKey = null; voices = [];
      var period = 60 / S.bpm;
      setSel(S.from); setBpm(S.bpm);
      var dotsAtStart = beatsBx.querySelectorAll('.transport__beat').length;
      toggle.click();
      var startT = T + START_LOOKAHEAD;   // metronome.js's own start() offset, read from source
      var pending = [];
      (S.changes || []).forEach(function (b, i) {
        pending.push({ at: startT + b * period, kind: 'meter', v: S.tos ? S.tos[i] : S.to, beat: b });
      });
      if (S.bpmChange) pending.push({ at: startT + S.bpmChange.at * period, kind: 'bpm', v: S.bpmChange.bpm, beat: S.bpmChange.at });
      pending.sort(function (a, b) { return a.at - b.at; });
      var endT = startT + S.until * period + 0.2;
      function step() {
        T = +(T + DT).toFixed(6);
        while (pending.length && T >= pending[0].at) {
          var p = pending.shift();
          if (p.kind === 'meter') { setSel(p.v); sample('meter=' + p.v + '@' + p.beat); }
          else { setBpm(p.v); sample('bpm=' + p.v + '@' + p.beat); }
        }
        sample(null);
        if (T < endT) { cw.setTimeout(step, DT * 1000); return; }
        toggle.click();
        out.scenarios.push({ name: S.name, dotsAtStart: dotsAtStart,
          dotsAtEnd: beatsBx.querySelectorAll('.transport__beat').length,
          start: +startT.toFixed(4), period: +period.toFixed(6), events: events, voices: voices });
        si++; cw.setTimeout(runScenario, 20);
      }
      cw.setTimeout(step, DT * 1000);
    }
    runScenario();
  } catch (err) { done({ error: String((err && err.stack) || err) }); }
}, 300); };
</script></body>`
  .replace('__SCENARIOS__', JSON.stringify(SCENARIOS))
  .replace('__DT__', String(DT))
  .replace('__LOOKAHEAD__', String(START_LOOKAHEAD))
  .replace('__PAGE__', JSON.stringify(PAGE));

// _site/dev/ is the ONE directory audit-site.js's walk skips, so a harness left
// behind by a crash cannot be counted into info.pageCount or fail
// dom.pagesMissingMain / dom.pagesMissingSkipLink. A harness at the _site root
// has no <main> and no skip link, and has already cost this loop two ticks.
// dev/ is absent from a production build; if this check created it, this check
// removes it.
const devDir = path.join(SITE, 'dev');
const devDirWasOurs = !fs.existsSync(devDir);
fs.mkdirSync(devDir, { recursive: true });
const harnessRel = 'dev/__metro-phase-check.html';
const harnessPath = path.join(SITE, harnessRel);
fs.writeFileSync(harnessPath, HARNESS, 'utf8');

const TYPES = { '.html': 'text/html;charset=utf-8', '.css': 'text/css;charset=utf-8',
  '.js': 'text/javascript;charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.wav': 'audio/wav', '.json': 'application/json', '.xml': 'application/xml' };

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(req.url.split('?')[0]);
  let file = path.join(SITE, p);
  try { if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html'); } catch (e) { /* 404 below */ }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
});

function cleanup() {
  try { fs.unlinkSync(harnessPath); } catch (e) {}
  if (devDirWasOurs) { try { fs.rmdirSync(devDir); } catch (e) {} }
  try { server.close(); } catch (e) {}
}

// spawn, NOT execFileSync: the static server lives in this process, so blocking
// the event loop would leave the browser waiting on a request nobody can answer.
server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-metro-phase-'));
  let dom = '';
  try {
    dom = await new Promise((resolve, reject) => {
      const child = spawn(browser, [
        '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
        '--user-data-dir=' + profile, '--timeout=200000', '--virtual-time-budget=180000',
        '--mute-audio', '--window-size=1400,1000', '--dump-dom',
        `http://127.0.0.1:${port}/${harnessRel}`,
      ], { stdio: ['ignore', 'pipe', 'ignore'] });
      let buf = '';
      child.stdout.setEncoding('utf8');
      child.stdout.on('data', d => { buf += d; });
      child.on('error', reject);
      child.on('close', () => resolve(buf));
    });
  } catch (e) {
    cleanup();
    fail('could not run the browser: ' + e.message);
  } finally {
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  }
  cleanup();

  const m = dom.match(/<div id="o">([\s\S]*?)<\/div>/);
  if (!m || m[1].trim() === 'pending') fail('the harness produced no measurements.');
  let data;
  try {
    data = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
  } catch (e) { fail('unreadable harness output: ' + e.message); }
  if (data.error) fail('harness error: ' + data.error);
  if (!data.scenarios || data.scenarios.length !== SCENARIOS.length) {
    fail(`expected ${SCENARIOS.length} scenarios, got ${(data.scenarios || []).length}.`);
  }

  const bad = [];
  let totalFlashes = 0, totalClicks = 0, worstAheadMs = 0, worstAheadWhere = '';
  let totalChanges = 0, staleAccentEvents = 0, disagreementStates = 0, changesWithStaleAccent = 0;

  for (let s = 0; s < SCENARIOS.length; s++) {
    const S = SCENARIOS[s], R = data.scenarios[s];
    const where = `"${S.name}"`;
    const N = S.tos ? S.tos[S.tos.length - 1] : S.to;

    if (R.dotsAtStart !== S.from) {
      bad.push(`${where}: asked for a ${S.from}-beat bar, the row rendered ${R.dotsAtStart} dots. Either renderBeats miscounts, or the dock has no <option value="${S.from}"> and setMeter refused it (dock offers ${(data.meta.options || []).join(',')}), in which case this scenario tested nothing`);
      continue;
    }
    if (R.dotsAtEnd !== N) {
      bad.push(`${where}: after the change the row has ${R.dotsAtEnd} dots, expected ${N}`);
      continue;
    }

    const clicks = R.voices.slice();
    for (let i = 1; i < clicks.length; i++) {
      if (clicks[i].t < clicks[i - 1].t) bad.push(`${where}: clicks were scheduled out of order at index ${i}`);
    }
    if (clicks.length < S.until - 1) { bad.push(`${where}: only ${clicks.length} clicks in ${S.until} beats — the click never really ran`); continue; }
    totalClicks += clicks.length;

    const accent = clicks.map(c => c.freq === 1500);
    const marks = R.events.filter(e => e.mark);
    if (marks.length !== (S.changes || []).length + (S.bpmChange ? 1 : 0)) {
      bad.push(`${where}: expected ${(S.changes || []).length + (S.bpmChange ? 1 : 0)} control changes, harness recorded ${marks.length}`);
      continue;
    }

    // ---- 1: a session always starts on a downbeat --------------------------
    if (!accent[0]) bad.push(`${where}: the session's FIRST click is not accented — a fresh start must be a downbeat`);

    // ---- 9b: the tempo actually reaches the running click -------------------
    // Without this, scenario 10 passes when setBpm stops writing session.bpm:
    // the phase is untouched (because nothing happened at all) and the check
    // prints that the tempo change left the phase alone, while the click ignored
    // the new tempo completely. The interval was measured and never asserted.
    // Every gap must equal 60/bpm for one of the tempos this scenario used, the
    // first gap must be the starting tempo, and where a tempo change happens the
    // last gap must be the NEW one.
    {
      const tempos = [S.bpm].concat(S.bpmChange ? [S.bpmChange.bpm] : []);
      const periods = tempos.map(b => 60 / b);
      const near = (g, p) => Math.abs(g - p) < 1e-3;
      const gaps = [];
      for (let i = 1; i < clicks.length; i++) gaps.push(+(clicks[i].t - clicks[i - 1].t).toFixed(4));
      const stray = gaps.find(g => !periods.some(p => near(g, p)));
      if (stray !== undefined) {
        bad.push(`${where}: a click interval of ${(stray * 1000).toFixed(1)}ms matches no tempo this scenario used (${tempos.map(b => b + ' BPM = ' + (60000 / b).toFixed(1) + 'ms').join(', ')}) — the scheduler is not spacing clicks at 60/bpm`);
      } else {
        if (gaps.length && !near(gaps[0], 60 / S.bpm)) {
          bad.push(`${where}: the click starts at ${(60000 / gaps[0]).toFixed(1)} BPM, not the ${S.bpm} BPM it was set to`);
        }
        if (S.bpmChange && gaps.length && !near(gaps[gaps.length - 1], 60 / S.bpmChange.bpm)) {
          bad.push(`${where}: after a change to ${S.bpmChange.bpm} BPM the click is still spaced ${(gaps[gaps.length - 1] * 1000).toFixed(1)}ms (${(60 / gaps[gaps.length - 1]).toFixed(1)} BPM) — the tempo never reached the running session`);
        }
        if (S.bpmChange && !gaps.some(g => near(g, 60 / S.bpmChange.bpm))) {
          bad.push(`${where}: not one interval in the whole run is ${(60000 / S.bpmChange.bpm).toFixed(1)}ms, so the tempo change did nothing at all`);
        }
      }
    }

    // ---- 10: the committed-ahead window ------------------------------------
    // Bounded by MAX_WINDOW_MS, declared in this file. Stale ACCENTS are counted
    // by identity, not per mark: two changes 72ms apart in the rapid scenario
    // see the same in-flight click, and counting it twice would overstate how
    // often a reader actually hears one.
    const staleAccentTimes = new Set();
    for (const mk of marks) {
      totalChanges++;
      const committed = clicks.slice(0, mk.vcount).filter(c => c.t > mk.t);
      const ahead = committed.length ? Math.max(...committed.map(c => c.t)) - mk.t : 0;
      if (ahead * 1000 > MAX_WINDOW_MS + 1e-3) {
        bad.push(`${where} at ${mk.mark}: ${(ahead * 1000).toFixed(0)}ms of the outgoing pattern was still committed, past the ${MAX_WINDOW_MS}ms budget. Every one of those clicks keeps the OLD accent, so the reader hears the old bar for that long after asking for a new one.`);
      }
      const staleHere = committed.filter(c => c.freq === 1500);
      if (staleHere.length) changesWithStaleAccent++;
      staleHere.forEach(c => staleAccentTimes.add(c.t));
      if (ahead * 1000 > worstAheadMs) { worstAheadMs = ahead * 1000; worstAheadWhere = `${S.name} at ${mk.mark}`; }
    }
    staleAccentEvents += staleAccentTimes.size;

    // ---- regions -----------------------------------------------------------
    // Before the first change the old meter must be clean; after the last one
    // the new meter must be clean from the very first newly scheduled click.
    const preEnd = S.noReset ? clicks.length : marks[0].vcount;
    const postStart = S.noReset ? clicks.length : marks[marks.length - 1].vcount;
    const lastChangeT = marks.length ? marks[marks.length - 1].t : Infinity;
    const firstChangeT = marks.length ? marks[0].t : Infinity;

    for (let i = 0; i < preEnd; i++) {
      if (accent[i] !== (i % S.from === 0)) {
        bad.push(`${where}: click ${i} before the change is ${accent[i] ? 'accented' : 'not accented'}; in ${S.from} beats it should be ${i % S.from === 0 ? 'accented' : 'not'}`);
        break;
      }
    }

    // ---- 3 + 4: the next NEWLY scheduled click is a downbeat, and it stays --
    if (!S.noReset) {
      if (postStart >= clicks.length) {
        bad.push(`${where}: no click was scheduled after the change; the scenario ends too early to prove anything`);
      } else if (!accent[postStart]) {
        const nextAcc = accent.indexOf(true, postStart);
        const late = nextAcc < 0 ? '(never)' : `${nextAcc - postStart} click(s) = ${((nextAcc - postStart) * R.period * 1000).toFixed(0)}ms late`;
        bad.push(`${where}: the first click scheduled AFTER the meter change is NOT accented — the next downbeat is ${late}. beatIndex kept its old count.`);
      }
      for (let i = postStart; i < clicks.length; i++) {
        if (accent[i] !== ((i - postStart) % N === 0)) {
          bad.push(`${where}: click ${i - postStart} after the change is ${accent[i] ? 'accented' : 'not accented'}; in ${N} beats it should be ${(i - postStart) % N === 0 ? 'accented' : 'not'}`);
          break;
        }
      }
    }

    // ---- flashes, matched to the click each one shows -----------------------
    const states = R.events.filter(e => !e.mark);
    const flashes = [];
    let prevLit = -1, prevPill = false;
    for (const e of states) {
      const lit = e.lit.length ? e.lit[0] : -1;
      if ((lit >= 0 && lit !== prevLit) || (lit < 0 && e.pill && !prevPill)) {
        flashes.push({ t: e.t, dot: lit, dots: e.lit.length, n: e.n,
          down: e.down.indexOf(lit) >= 0, pill: e.pill, pillDown: e.pillDown });
      }
      prevLit = lit; prevPill = e.pill;
    }
    totalFlashes += flashes.length;
    // Compared against clicks that had TIME to fire, not against every click
    // scheduled: the run is torn down while up to SCHEDULE_AHEAD of clicks are
    // still in the future, and how many of those fit varies run to run.
    //
    // THE ANCHOR MUST NOT COME FROM THE SAMPLED STATES. A previous version used
    // the last recorded state, and sample() only records a state CHANGE, so that
    // timestamp is the clear-time of the last flash. The anchor then moved with
    // the very thing it was measuring: stop flashing and it stops advancing,
    // firable shrinks to match, and the rule can never fire. A mutant that kept
    // the pulse loop running but stopped flashing after 8 beats per session
    // scored 80 flashes against 213 clicks and passed. Any exception thrown
    // inside flashBeat kills the rAF chain exactly that way.
    //
    // So the anchor is the scenario's OWN end time, recomputed here from what the
    // harness reports, independent of anything the DOM did.
    const runEndT = R.start + S.until * R.period + 0.2;
    const firable = clicks.filter(c => c.t <= runEndT - OBSERVE_MARGIN);
    if (flashes.length < firable.length) {
      bad.push(`${where}: ${firable.length} clicks had time to fire but only ${flashes.length} lit the row — the beat row is not following the click (look at the scheduler and the pulse loop, not only the CSS)`);
    }

    // ---- 6: row and pill agree, in every sampled state ----------------------
    let firstDisagreement = null;
    for (const e of states) {
      const rowLit = e.lit.length > 0, rowDown = e.down.length > 0;
      if (rowLit !== e.pill || rowDown !== e.pillDown) {
        disagreementStates++;
        if (!firstDisagreement) firstDisagreement = e;
      }
    }
    if (firstDisagreement) {
      const e = firstDisagreement;
      bad.push(`${where} at t=${e.t}: the row and the pill disagree — row lit=[${e.lit}] downbeat=${e.down.length > 0} vs pill lit=${e.pill} downbeat=${e.pillDown} (${e.n}-dot row)`);
    }

    for (const fl of flashes) {
      if (fl.dot < 0) { bad.push(`${where} at t=${fl.t}: the pill pulsed but no dot did (${fl.n}-dot row)`); break; }
      if (fl.dots !== 1) { bad.push(`${where} at t=${fl.t}: ${fl.dots} dots lit at once`); break; }
      if (!fl.pill) { bad.push(`${where} at t=${fl.t}: dot ${fl.dot} pulsed but the pill did not`); break; }
      if (fl.down !== fl.pillDown) { bad.push(`${where} at t=${fl.t}: dot downbeat=${fl.down} but pill downbeat=${fl.pillDown}`); break; }
      if (fl.dot >= fl.n) { bad.push(`${where} at t=${fl.t}: dot index ${fl.dot} in a ${fl.n}-dot row`); break; }
    }

    // ---- 2 + 5 + 7: what each flash SAYS vs what its click DID --------------
    let matched = 0, unmatched = 0;
    for (const fl of flashes) {
      let bi = -1, bd = Infinity;
      for (let i = 0; i < clicks.length; i++) {
        const dd = Math.abs(clicks[i].t - fl.t);
        if (dd < bd) { bd = dd; bi = i; }
      }
      if (bd > MATCH_WINDOW) { unmatched++; continue; }
      matched++;
      if (fl.down !== accent[bi]) {
        bad.push(`${where} at t=${fl.t}: dot ${fl.dot} shows downbeat=${fl.down} but its click was ${accent[bi] ? 'accented' : 'not accented'}`);
        break;
      }
      // Keyed on when the flash FIRED, not when its click was scheduled: a click
      // committed before the change can still be in flight when the row is
      // rebuilt, and the row it lands in is the new one.
      if (bi < preEnd && fl.t < firstChangeT && fl.dot !== bi % S.from) {
        bad.push(`${where} at t=${fl.t}: click ${bi} lit dot ${fl.dot}, expected ${bi % S.from} in a ${S.from}-beat bar`);
        break;
      }
      if (!S.noReset && bi >= postStart && fl.dot !== (bi - postStart) % N) {
        bad.push(`${where} at t=${fl.t}: click ${bi - postStart} after the change lit dot ${fl.dot}, expected ${(bi - postStart) % N} in a ${N}-beat bar`);
        break;
      }
      // A click committed under the OLD meter but firing into the new row may be
      // re-pointed, never promoted: only a genuinely accented click may light 1.
      if (bi < postStart && fl.t > lastChangeT && fl.dot === 0 && !accent[bi]) {
        bad.push(`${where} at t=${fl.t}: a leftover click from the old meter lit dot 1 without being accented — the fallback invented a downbeat`);
        break;
      }
    }
    if (unmatched > 1) bad.push(`${where}: ${unmatched} flashes matched no click within ${MATCH_WINDOW * 1000}ms`);
    if (matched < 5) bad.push(`${where}: only ${matched} flashes could be matched to clicks; the transcript is not measuring anything`);
  }

  if (bad.length) {
    bad.push('');
    bad.push('setMeter must zero session.beatIndex when the meter actually changes, so the next');
    bad.push('NEWLY scheduled click is a downbeat; flashBeat must keep the dot index inside the row');
    bad.push('so the pill never pulses alone; renderBeats must clear the pill when it wipes the row.');
    fail(bad);
  }

  // Every number below is counted from the run. Nothing here is a fixed string
  // asserting something the run did not check: a hard-coded "0 disagreements"
  // is how a mutant that broke the tempo still printed a reassuring sentence.
  const meters = (data.meta.options || []).join(', ');
  const meterChanges = totalChanges - SCENARIOS.filter(s => s.bpmChange).length;
  const resetChanges = SCENARIOS.filter(s => !s.noReset).reduce((a, s) => a + s.changes.length, 0);
  const heldChanges = totalChanges - resetChanges;
  console.log(`[check-metro-phase] OK — ${SCENARIOS.length} scenarios in a real browser: ${totalClicks} clicks, ${totalFlashes} beat-row flashes, ${disagreementStates} row/pill disagreements.`);
  console.log(`  ${totalChanges} control changes (${meterChanges} meter, ${totalChanges - meterChanges} tempo): ${resetChanges} required a phase reset and got one on the next newly scheduled click; ${heldChanges} required the phase to be LEFT ALONE and it was.`);
  console.log(`  click spacing matched 60/bpm on every interval, so each tempo reached the running session.`);
  console.log(`  dock meters read from the page: ${meters}`);
  console.log(`  worst committed-ahead window: ${worstAheadMs.toFixed(0)}ms against a ${MAX_WINDOW_MS}ms budget (${worstAheadWhere}); scheduler SCHEDULE_AHEAD=${SCHEDULE_AHEAD * 1000}ms, start lookahead=${START_LOOKAHEAD * 1000}ms.`);
  // Two different units, so they are named separately rather than divided into
  // one ratio: clicks are deduplicated by identity (two changes 72ms apart in
  // the rapid scenario see the SAME click in flight), while changes are counted
  // per press.
  console.log(`  ${staleAccentEvents} distinct ACCENTED click(s) were still in flight across ${totalChanges} changes; ${changesWithStaleAccent} of the changes saw one. The reader hears those after the change (BL-101 follow-up, not fixed here).`);
  process.exit(0);
});
