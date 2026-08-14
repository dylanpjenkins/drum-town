#!/usr/bin/env node
// check-accent-dynamics.js — BL-097's guarantee: the audio plays the accents.
//
// Until iteration 62 the stave drew a ">" (notation-renderer.js:114) and the
// player ignored it, so on funk-ghost-notes#0 — the flagship exercise of the
// lesson about ghost notes, whose tip asks for "a 4-to-1 ratio between accented
// and ghosted snare" — all five snare strokes came out at one volume. None of
// the other gates can hear anything, so nothing would have caught it coming back.
//
// This one measures. It renders the SHIPPED data-spec of a real built page
// through the REAL player.js inside an OfflineAudioContext and reads the samples
// back, which makes every claim below a number rather than an assertion:
//
//   1. RATIO. With the other voices' keys dropped so nothing masks the attack,
//      the accented stroke's peak divided by an unaccented one must land in the
//      band that case declares: `expect: 'ghost'` near 4-to-1 (the number
//      funk-ghost-notes and hiphop-boom-bap both print in prose) or
//      `expect: 'tap'` near 2-to-1. Cases cover the snare, the toms, the feet,
//      both kits, and the tap tier, because a single snare case leaves four ways
//      to break this silently: dropping toms from GHOST_VOICES, setting
//      GAIN_TAP = 1, handing the feet voice an empty `marked`, and reading the
//      dynamic from the post-articulation voice name.
//
//   2. NOTHING GOT LOUDER. Every case is rendered twice: once as shipped and
//      once with every accent flag stripped. A spec with no accents marks no
//      voices, so no gain node is created and the graph is the one the player
//      built before this feature existed — the stripped render IS the old
//      behaviour, reproduced from the current code.
//
//      The invariant that actually holds is RMS: over all 201 accent-lowering
//      exercises it fell in 201 and rose in none, so it is asserted flat. PEAKS
//      are a weaker claim and the honest bound is not 1.0 — samples are signed
//      and the mix is a linear sum, so lowering one of two partially cancelling
//      contributions can raise |sum|. 71 of the 201 have a note window above its
//      accent-blind level, worst 1.019 (funk-james-brown#3). LOUDER_TOL is
//      calibrated between that ceiling and the 1.20 an accent-boost mutant
//      produces; it is load-bearing, and tightening it to ~1.0 will fail correct
//      code as soon as a new case is added.
//
//   3. THE OSTINATO IS UNTOUCHED. funk-ghost-notes#0 accents hat+snare on one
//      stem. Reading that mark per-key would ghost the hi-hat line the groove
//      rides on, so the hat-only windows must come out bit-identical to the
//      stripped render.
//
// KNOWN BLIND SPOT: the open-hat path. If the dynamic were read from the voice
// name AFTER the `open` articulation swap, an unaccented open hat would play at
// full level — but no exercise in the corpus has an unaccented open hat in a spec
// that accents its hat line, so that mutant is behaviourally identical to correct
// code on today's content and no page can catch it. It becomes catchable the day
// such an exercise is written.
//
// Two notes on the harness, both learned the hard way:
//   - the result comes back over HTTP, not via --dump-dom, because
//     OfflineAudioContext.startRendering() never completes under
//     --virtual-time-budget (the first version of this hung at "pending").
//   - Math.random is replaced with a seeded PRNG before player.js loads. Every
//     synthesized voice shares one cached white-noise buffer, so without a seed
//     two renders of one pattern differ by construction. Compared against itself
//     the renderer still wobbles by 1.19e-7 (float32 epsilon), which is the floor
//     EPS below is set from.
//
// Exits 0 on pass, 1 on fail, and 0 with a loud SKIP if Edge is not installed.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SITE = path.join(ROOT, '_site');
const DEVDIR = path.join(SITE, 'dev');          // the one directory audit-site.js skips

const EPS = 2e-7;                 // the renderer's own float32 reproducibility floor
// What each tier must do to a note, measured as that note's own peak divided by
// its peak in the accent-blind render. This is the gain the player applied, not an
// accent-to-ghost ratio across the bar: two notes of one voice are not at the same
// level even before this feature (a paradiddle's accented note reads 1.31x its own
// taps in the ACCENT-BLIND render, purely from where the noise bursts sum), so a
// cross-note ratio measures the exercise as much as the code. Comparing each note
// to itself removes all of that and lands on 0.250 / 0.500 / 1.000 exactly.
const TIERS = {
  ghost: 0.25,
  tap:   0.5,
};
const TIER_TOL = 0.08;            // measured spread is 0.249-0.253; this is generous
const ACCENT_TOL = 0.01;          // an accented note must be left alone
const LOUDER_TOL = 1.03;          // see note 2 in the header: 1.019 measured, 1.20 for a boost
const RMS_TOL = 1.0000001;        // RMS fell in 201 of 201 exercises; assert it flat
const QUIETER_TOL = 0.99;         // an unaccented ostinato voice may not be attenuated
const TIMEOUT_MS = 180000;

// Every case is rendered twice, shipped and accent-stripped. `voiceKey` names the
// voice whose per-note attenuation is asserted and `drop` removes every other voice
// so nothing masks its attack; `ostinato` names a voice that must come out
// bit-identical. A case with voiceKey: null asserts only its ostinato — the full
// funk render cannot measure the snare tier because the hi-hat sits inside every
// snare window at full level.
const CASES = [
  { id: 'funk/electronic/full',      page: '/lessons/funk-ghost-notes/',  ex: 0, kit: 'electronic', drop: null,
    voiceKey: null,     expect: null,    ostinato: 'g/5/x2' },
  { id: 'funk/electronic/snare',     page: '/lessons/funk-ghost-notes/',  ex: 0, kit: 'electronic', drop: ['g/5/x2'],
    voiceKey: 'c/5',    expect: 'ghost' },
  { id: 'funk/acoustic/snare',       page: '/lessons/funk-ghost-notes/',  ex: 0, kit: 'acoustic',   drop: ['g/5/x2'],
    voiceKey: 'c/5',    expect: 'ghost' },
  { id: 'boombap/electronic/snare',  page: '/lessons/hiphop-boom-bap/',   ex: 2, kit: 'electronic', drop: ['g/5/x2'],
    voiceKey: 'c/5',    expect: 'ghost' },
  // the sticking veto: identical spec shape to ghost-found#2, uppercase, so TAP
  { id: 'paradiddle/electronic/tap', page: '/lessons/paradiddle/',        ex: 0, kit: 'electronic', drop: [],
    voiceKey: 'c/5',    expect: 'tap' },
  { id: 'ghostfound/electronic/lc',  page: '/lessons/ghost-notes-found/', ex: 2, kit: 'electronic', drop: [],
    voiceKey: 'c/5',    expect: 'ghost' },
  // the tom path
  { id: 'polyrhythm/electronic/tom', page: '/lessons/polyrhythms-3-2/',   ex: 3, kit: 'electronic', drop: ['a/4'],
    voiceKey: 'e/5',    expect: 'ghost' },
  // the feet path — an accented kick, which is not a ghost voice
  { id: 'jazzmodern/electronic/kick', page: '/lessons/jazz-modern-jazz/', ex: 2, kit: 'electronic',
    drop: ['f/5/x2', 'c/5', 'd/4/x2'], voiceKey: 'f/4', expect: 'tap' },
  // the tap tier on a cymbal, in the sample-based kit
  { id: 'rockdynamics/acoustic/hat', page: '/lessons/rock-dynamics/',     ex: 1, kit: 'acoustic', drop: ['c/5', 'f/4'],
    voiceKey: 'g/5/x2', expect: 'tap' },
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

if (!fs.existsSync(path.join(SITE, 'index.html'))) {
  console.error('[check-accent-dynamics] FAIL — _site is missing. Run `npm run build` first.');
  process.exit(1);
}
const browser = findBrowser();
if (!browser) {
  console.warn('[check-accent-dynamics] SKIP — no Edge/Chrome binary found; audio cannot be rendered here.');
  process.exit(0);
}

// ---- frame: one render per JS realm (player.js caches its AudioContext) ----
const FRAME = `<!doctype html><meta charset="utf-8"><body><div id="o">pending</div>
<script>
(function () {
  var s = 0x2f6e2b1 >>> 0;
  Math.random = function () {
    s = (s + 0x6D2B79F5) >>> 0;
    var t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  window.__renderSecs = 6;
  window.AudioContext = function () {
    var sr = 44100;
    var oc = new OfflineAudioContext(2, Math.ceil(window.__renderSecs * sr), sr);
    oc.resume = function () { return Promise.resolve(); };   // offline starts suspended
    window.__ctx = oc;
    return oc;
  };
  try { delete window.webkitAudioContext; } catch (e) { window.webkitAudioContext = undefined; }
})();
</script>
<script src="/assets/js/pattern-math.js"></script>
<script src="/assets/js/player.js" onload="window.__playerLoaded=1"></script>
<script>
(async function () {
  var out = document.getElementById('o');
  try {
    const q = new URLSearchParams(location.search);
    const kase = parent.__CASES[Number(q.get('i'))];
    const strip = q.get('strip') === '1';

    const html = await (await fetch(kase.page)).text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const spec = JSON.parse(doc.querySelectorAll('[data-exercise-play]')[kase.ex].getAttribute('data-spec'));
    for (const v of ['hands', 'feet']) {
      (spec[v] || []).forEach(function (n) {
        if (strip) delete n.accent;
        if (!kase.drop || !n.keys) return;
        n.keys = n.keys.filter(function (k) { return kase.drop.indexOf(k) === -1; });
        if (!n.keys.length) { n.rest = true; delete n.keys; }
      });
    }
    while (!window.__playerLoaded) await new Promise(function (r) { setTimeout(r, 10); });

    const patDur = PatternMath.patternDurationSecs(spec);
    window.__renderSecs = patDur + 1.5;

    const wrap = document.createElement('div');
    wrap.className = 'exercise';
    wrap.innerHTML = '<select data-exercise-kit><option value="electronic">Electronic</option>' +
      '<option value="acoustic">Acoustic</option></select><button data-exercise-play></button>';
    document.body.appendChild(wrap);
    const btn = wrap.querySelector('[data-exercise-play]');
    wrap.querySelector('[data-exercise-kit]').value = kase.kit;
    btn.dataset.spec = JSON.stringify(spec);
    btn.click();
    for (let i = 0; i < 2000 && !btn._session; i++) await new Promise(function (r) { setTimeout(r, 5); });
    if (!btn._session) throw new Error('no PlaybackSession after click');
    clearInterval(btn._session.timer);   // currentTime is 0 offline: one bar, no top-up overlay
    btn._session.timer = null;

    const buf = await window.__ctx.startRendering();
    const ch = buf.getChannelData(0), sr = buf.sampleRate;
    const bpm = spec.bpm || 80, notes = [];
    for (const v of ['hands', 'feet']) {
      const arr = spec[v] || [];
      const scale = PatternMath.tupletScales(spec, v, arr.length);
      let t = 0.06;                       // PlaybackSession.start()'s lookahead
      arr.forEach(function (n, i) {
        const ticks = PatternMath.durationTicks(n);
        const dur = (ticks === null ? 1 : ticks) * scale[i] * (60 / bpm);
        if (!n.rest) notes.push({ v: v, i: i, t: t, dur: dur, keys: (n.keys || []).join('+'),
                                  accent: n.accent === true });
        t += dur;
      });
    }
    let peak = 0, sq = 0;
    for (let i = 0; i < ch.length; i++) { const x = Math.abs(ch[i]); if (x > peak) peak = x; sq += ch[i] * ch[i]; }
    const rms = Math.sqrt(sq / ch.length);
    notes.forEach(function (n) {
      const i0 = Math.max(0, Math.floor(n.t * sr));
      const i1 = Math.min(ch.length, Math.ceil((n.t + Math.min(0.02, n.dur * 0.9)) * sr));
      let p = 0;
      for (let i = i0; i < i1; i++) { const x = Math.abs(ch[i]); if (x > p) p = x; }
      n.peak = p; n.i0 = i0; n.i1 = i1;
    });
    window.__samples = ch;
    window.__result = { id: kase.id, strip: strip, sr: sr, peak: peak, rms: rms, notes: notes };
    out.textContent = 'done';
  } catch (e) { out.textContent = JSON.stringify({ error: String((e && e.stack) || e) }); }
})();
</script></body>`;

const PARENT = `<!doctype html><meta charset="utf-8"><body><div id="o">pending</div>
<script>
window.__CASES = __CASES__;
function frame(i, strip) {
  return new Promise(function (resolve, reject) {
    const f = document.createElement('iframe');
    f.style.cssText = 'position:absolute;left:-9000px;width:400px;height:60px;border:0';
    f.src = '__FRAME__?i=' + i + '&strip=' + (strip ? 1 : 0);
    f.onload = async function () {
      for (let n = 0; n < 6000; n++) {
        if (f.contentWindow && f.contentWindow.__result) return resolve(f);
        const el = f.contentDocument && f.contentDocument.getElementById('o');
        if (el && el.textContent.charAt(0) === '{') return reject(new Error(el.textContent));
        await new Promise(function (r) { setTimeout(r, 5); });
      }
      reject(new Error('frame ' + i + ' strip=' + strip + ' timed out'));
    };
    f.onerror = function () { reject(new Error('iframe load error')); };
    document.body.appendChild(f);
  });
}
(async function () {
  const rows = [];
  try {
    for (let i = 0; i < window.__CASES.length; i++) {
      const shipped = await frame(i, false);
      const stripped = await frame(i, true);
      const S = shipped.contentWindow, T = stripped.contentWindow;
      const a = S.__samples, b = T.__samples;
      rows.push({
        id: S.__result.id, sr: S.__result.sr,
        peakShipped: S.__result.peak, peakStripped: T.__result.peak,
        rmsShipped: S.__result.rms, rmsStripped: T.__result.rms,
        notes: S.__result.notes.map(function (n, k) {
          const t = T.__result.notes[k];
          let wd = 0;
          const end = Math.min(n.i1, a.length, b.length);
          for (let j = n.i0; j < end; j++) { const d = Math.abs(a[j] - b[j]); if (d > wd) wd = d; }
          return { v: n.v, i: n.i, t: +n.t.toFixed(5), keys: n.keys, accent: n.accent,
                   peakShipped: n.peak, peakStripped: t ? t.peak : null, winMaxDiff: wd };
        })
      });
      shipped.remove(); stripped.remove();
    }
  } catch (e) { rows.push({ error: String((e && e.stack) || e) }); }
  const json = JSON.stringify(rows);
  document.getElementById('o').textContent = json;
  try { await fetch('/__result', { method: 'POST', body: json }); } catch (e) {}
})();
</script></body>`;

// ---- write the harness, serve _site, drive the browser ----

const FRAME_NAME = '__accent-dynamics-frame.html';
const PARENT_NAME = '__accent-dynamics.html';
const createdDevDir = !fs.existsSync(DEVDIR);
fs.mkdirSync(DEVDIR, { recursive: true });
fs.writeFileSync(path.join(DEVDIR, FRAME_NAME), FRAME, 'utf8');
fs.writeFileSync(path.join(DEVDIR, PARENT_NAME),
  PARENT.replace('__CASES__', JSON.stringify(CASES)).replace('__FRAME__', '/dev/' + FRAME_NAME), 'utf8');

function cleanup() {
  for (const n of [FRAME_NAME, PARENT_NAME]) {
    try { fs.unlinkSync(path.join(DEVDIR, n)); } catch (e) {}
  }
  if (createdDevDir) { try { fs.rmdirSync(DEVDIR); } catch (e) {} }
}

const TYPES = { '.html': 'text/html;charset=utf-8', '.css': 'text/css;charset=utf-8',
  '.js': 'text/javascript;charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.wav': 'audio/wav', '.json': 'application/json', '.xml': 'application/xml' };

let deliver = null;
const server = http.createServer((req, res) => {
  if (req.method === 'POST') {
    let body = '';
    req.on('data', d => { body += d; });
    req.on('end', () => { res.writeHead(204); res.end(); if (deliver) deliver(body); });
    return;
  }
  let f = path.join(SITE, decodeURIComponent(req.url.split('?')[0]));
  try { if (fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); } catch (e) { /* 404 below */ }
  fs.readFile(f, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('404'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
    res.end(buf);
  });
});

function bail(msg) {
  cleanup();
  console.error('[check-accent-dynamics] FAIL — ' + msg);
  process.exit(1);
}

server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-accent-'));
  const child = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run',
    '--no-default-browser-check', '--user-data-dir=' + profile, '--mute-audio',
    '--autoplay-policy=no-user-gesture-required', '--window-size=800,600',
    `http://127.0.0.1:${port}/dev/${PARENT_NAME}`], { stdio: ['ignore', 'ignore', 'ignore'] });

  const body = await new Promise((resolve) => {
    deliver = resolve;
    setTimeout(() => resolve(null), TIMEOUT_MS);
  });
  try { child.kill(); } catch (e) {}
  server.close();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
  cleanup();

  if (body === null) bail('the harness produced no measurements (timed out).');
  let rows;
  try { rows = JSON.parse(body); } catch (e) { bail('unreadable harness output: ' + e.message); }
  if (rows.length === 1 && rows[0].error) bail('the harness threw: ' + rows[0].error);
  if (rows.length !== CASES.length) bail(`expected ${CASES.length} cases, got ${rows.length}.`);

  const fails = [];
  const lines = [];
  const byId = Object.fromEntries(CASES.map(c => [c.id, c]));

  for (const r of rows) {
    const kase = byId[r.id];
    if (!kase) { fails.push(`unknown case id ${r.id}`); continue; }

    // 2. nothing got louder than the accent-blind render. RMS is the hard one;
    // peaks get LOUDER_TOL because cancellation can lift one by up to ~1.9%.
    if (r.rmsShipped > r.rmsStripped * RMS_TOL) {
      fails.push(`${r.id} — RMS ${r.rmsShipped.toFixed(6)} is above the accent-blind ` +
                 `${r.rmsStripped.toFixed(6)}: the exercise got louder overall`);
    }
    if (r.peakShipped > r.peakStripped * LOUDER_TOL) {
      fails.push(`${r.id} — buffer peak ${r.peakShipped.toFixed(6)} exceeds the accent-blind ` +
                 `${r.peakStripped.toFixed(6)} by more than cancellation explains: an accent is being ` +
                 `boosted, not the plain notes lowered`);
    }
    for (const n of r.notes) {
      if (n.peakStripped !== null && n.peakShipped > n.peakStripped * LOUDER_TOL) {
        fails.push(`${r.id} — ${n.v}#${n.i} (${n.keys}) at ${n.t}s peaks ${n.peakShipped.toFixed(6)} ` +
                   `vs ${n.peakStripped.toFixed(6)} accent-blind`);
      }
    }

    // 1. the tier this case declares, on the voice this case names
    if (kase.voiceKey) {
      const want = TIERS[kase.expect];
      if (want === undefined) { fails.push(`${r.id} — unknown expect: ${kase.expect}`); continue; }
      const voice = r.notes.filter(n => (n.keys || '').split('+').indexOf(kase.voiceKey) !== -1);
      const acc = voice.filter(n => n.accent), quiet = voice.filter(n => !n.accent);
      if (!acc.length || !quiet.length) {
        fails.push(`${r.id} — expected accented and unaccented ${kase.voiceKey} notes, got ` +
                   `${acc.length}/${quiet.length}. The case's drop list or exercise index is wrong, ` +
                   `so this case has been asserting nothing.`);
        continue;
      }
      const att = n => n.peakStripped > 0 ? n.peakShipped / n.peakStripped : 1;
      const qAtt = quiet.map(att), aAtt = acc.map(att);
      const qLo = Math.min(...qAtt), qHi = Math.max(...qAtt);
      const aLo = Math.min(...aAtt), aHi = Math.max(...aAtt);
      // the human-readable number the lessons talk about, for the log only
      const med = xs => { const s = [...xs].sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; };
      const ratio = med(acc.map(n => n.peakShipped)) / med(quiet.map(n => n.peakShipped));
      lines.push(`  ${r.id} [${kase.expect} ${want}] ${kase.voiceKey}: ${quiet.length} lowered note(s) at ` +
                 `${qLo.toFixed(3)}-${qHi.toFixed(3)}x, ${acc.length} accented at ${aLo.toFixed(3)}-${aHi.toFixed(3)}x` +
                 `, sounding ${ratio.toFixed(2)}-to-1`);
      if (qLo < want - TIER_TOL || qHi > want + TIER_TOL) {
        fails.push(`${r.id} — unaccented ${kase.voiceKey} notes land at ${qLo.toFixed(3)}-${qHi.toFixed(3)}x ` +
                   `their accent-blind level; the ${kase.expect} tier is ${want}`);
      }
      if (aLo < 1 - ACCENT_TOL || aHi > 1 + ACCENT_TOL) {
        fails.push(`${r.id} — accented ${kase.voiceKey} notes land at ${aLo.toFixed(3)}-${aHi.toFixed(3)}x ` +
                   `their accent-blind level; an accent must be left exactly as it was`);
      }
    }

    // 3. the ostinato under an accented backbeat is untouched. Only for cases that
    // declare one — in rock-dynamics the hat IS the accented voice and must drop.
    // Compared per window against that window's own accent-blind render, so the
    // kick landing inside two of them cannot confuse the measurement.
    if (kase.ostinato) {
      const os = r.notes.filter(n => n.keys === kase.ostinato);
      if (os.length < 8) {
        fails.push(`${r.id} — only ${os.length} bare ${kase.ostinato} windows; the ostinato check needs 8+, ` +
                   `so this case has been asserting nothing`);
        continue;
      }
      const moved = os.filter(n => n.winMaxDiff > EPS);
      const worst = Math.min(...os.map(n => n.peakShipped / n.peakStripped));
      lines.push(`  ${r.id} ostinato ${kase.ostinato}: ${os.length} bare windows — quietest ${worst.toFixed(4)}x, ` +
                 `${os.length - moved.length} bit-identical, max|diff| ` +
                 `${Math.max(...os.map(n => n.winMaxDiff)).toExponential(2)}`);
      if (worst < QUIETER_TOL) {
        fails.push(`${r.id} — a bare ${kase.ostinato} window dropped to ${worst.toFixed(4)}x of its accent-blind ` +
                   `level: the accent on a unison stem is being read as an accent on the ostinato voice too`);
      }
      // Windows that follow a lowered snare carry its decay tail, so a couple of
      // them legitimately differ; more than a third would mean the line itself
      // is being scaled.
      if (moved.length > os.length / 3) {
        fails.push(`${r.id} — ${moved.length} of ${os.length} bare ${kase.ostinato} windows changed, more than ` +
                   `the ghost decay tails can account for`);
      }
    }
  }

  if (fails.length) {
    console.error('[check-accent-dynamics] FAIL:');
    fails.forEach(f => console.error('  ' + f));
    console.error(`\n  The levels live in one table at the top of src/assets/js/player.js: an accented note`);
    console.error(`  keeps the voice's own peak (1.0); an unaccented snare or tom of an accented voice drops`);
    console.error(`  to 0.25 (the 4-to-1 the lessons print) UNLESS its own sticking is uppercase, which the`);
    console.error(`  corpus writes for a full stroke, in which case it is a tap at 0.5; an unaccented cymbal`);
    console.error(`  or kick drops to 0.5. Nothing is ever raised, so "no exercise gets louder" holds by`);
    console.error(`  construction — do not fix a ratio by boosting the accent.`);
    process.exit(1);
  }

  console.log('[check-accent-dynamics] OK — ' + rows.length + ' offline renders of shipped specs, ' +
              'each against its own accent-blind control:');
  lines.forEach(l => console.log(l));
  process.exit(0);
});
