#!/usr/bin/env node
// check-tempo-handoff.js — BL-076's half of "the whole town practices to the
// same clock".
//
// A playable exercise carries a button that hands its own tempo to the transport
// dock — but only where the dock can be made to agree with the notation exactly.
// Both halves of that sentence need enforcing, and the second half is the one
// that bit: the first version of this check read the meter <select> out of the
// built markup so the two could not drift, and never read the min/max on the BPM
// input fourteen lines above it. Two defects shipped through it:
//
//   * seven exercises named a tempo the dock refuses (250 to 280 against
//     max="240"; metronome.js clamps, so the click arrived 14% slow and silent
//     about it);
//   * every x/8 exercise handed over a bar twice the notated one, because
//     spec.bpm is QUARTER-note BPM (pattern-math.js:4) while the dock's number is
//     clicks per minute and beatsPerBar is clicks per BAR. Numerator-as-beats is
//     only right when the beat is a quarter.
//
// So "offerable" is now two conditions, both derived from the dock's OWN built
// markup rather than restated here, and absence is asserted as hard as presence.
// For every exercise block on every built page:
//
//   1. a handoff button exists exactly when the exercise's tempo is inside the
//      built input's min..max AND its signature is in the built select AND its
//      denominator is 4 — and does NOT exist otherwise;
//   2. handoff data-bpm === the bpm inside its own play button's data-spec;
//   3. data-beats === the built select's option value for that signature;
//   4. the visible label is exactly "Metronome <bpm>";
//   5. the accessible name starts with the visible label (WCAG 2.5.3 is string
//      containment, and voice control needs a landing string), leads with the
//      same number, and names the same meter.
//
// Exits 0 on pass, 1 on fail.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const SITE = path.join(ROOT, '_site');

if (!fs.existsSync(path.join(SITE, 'index.html'))) {
  console.error('[check-tempo-handoff] FAIL — _site is missing. Run `npm run build` first.');
  process.exit(1);
}

function htmlFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'dev') htmlFiles(p, out); }
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

// escapeAttr in .eleventy.js escapes exactly these three, in this order.
function unescapeAttr(s) {
  return s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}
function attrOf(attrs, name) {
  const m = new RegExp(`\\b${name}="([^"]*)"`).exec(attrs);
  return m ? m[1] : null;
}

// ---- what the dock can actually do, read out of the built dock -----------------
// One page is enough: base.njk prints the same dock on all of them, and the tail
// of this file proves that by counting.
let dockMeters = null, dockMin = null, dockMax = null;
{
  const html = fs.readFileSync(path.join(SITE, 'index.html'), 'utf8');
  const sel = /<select[^>]*class="transport__timesig"[\s\S]*?<\/select>/.exec(html);
  if (!sel) {
    console.error('[check-tempo-handoff] FAIL — no .transport__timesig select in _site/index.html; the dock markup moved.');
    process.exit(1);
  }
  dockMeters = {};
  const optRe = /<option value="(\d+)"[^>]*>([^<]+)<\/option>/g;
  let m;
  while ((m = optRe.exec(sel[0]))) dockMeters[m[2].trim()] = Number(m[1]);
  if (!Object.keys(dockMeters).length) {
    console.error('[check-tempo-handoff] FAIL — the dock meter select has no options.');
    process.exit(1);
  }
  const inp = /<input[^>]*class="transport__bpm"[^>]*>/.exec(html);
  if (!inp) {
    console.error('[check-tempo-handoff] FAIL — no .transport__bpm input in _site/index.html; the dock markup moved.');
    process.exit(1);
  }
  dockMin = Number(attrOf(inp[0], 'min'));
  dockMax = Number(attrOf(inp[0], 'max'));
  if (!Number.isFinite(dockMin) || !Number.isFinite(dockMax) || dockMin >= dockMax) {
    console.error(`[check-tempo-handoff] FAIL — the dock BPM input has no usable min/max (got ${dockMin}/${dockMax}).`);
    process.exit(1);
  }
}

// The dock's beat is a quarter note: its number is clicks per minute and
// beatsPerBar is clicks per bar, while every spec.bpm on this site is quarter-note
// BPM. So a signature is offerable only if the select holds it AND a beat in it
// IS a quarter — otherwise numerator-as-beats stretches the bar by 4/denominator.
function offerable(ts, bpm) {
  const parts = String(ts || '').trim().split('/');
  if (Number(parts[1]) !== 4) return false;
  if (!Object.prototype.hasOwnProperty.call(dockMeters, String(ts).trim())) return false;
  return bpm >= dockMin && bpm <= dockMax;
}

const pages = htmlFiles(SITE).sort();
const failures = [];
let exercises = 0, withHandoff = 0, omittedRange = 0, omittedMeter = 0, pagesWithDock = 0;

const PLAY_RE  = /<button class="play-btn"[^>]*data-spec="([^"]*)"[^>]*>/g;
const TEMPO_RE = /<button class="tempo-btn"([^>]*)>([^<]*)<\/button>/g;

for (const f of pages) {
  const rel = path.relative(SITE, f).replace(/\\/g, '/');
  const html = fs.readFileSync(f, 'utf8');
  if (html.includes('class="transport__timesig"')) pagesWithDock++;

  // Interleave both button kinds in document order. The shortcode emits the
  // handoff immediately before its own play button inside one .exercise-controls,
  // so a handoff belongs to the very next play button and a play button's handoff
  // is the entry directly before it — which survives the omissions, where a
  // by-index pairing of the two lists would not.
  const nodes = [];
  let m;
  PLAY_RE.lastIndex = 0;
  while ((m = PLAY_RE.exec(html))) nodes.push({ type: 'play', at: m.index, spec: m[1] });
  TEMPO_RE.lastIndex = 0;
  while ((m = TEMPO_RE.exec(html))) nodes.push({ type: 'tempo', at: m.index, attrs: m[1], label: m[2].trim() });
  nodes.sort((a, b) => a.at - b.at);

  if (nodes.some(n => n.type === 'play') && !html.includes('id="site-metronome"')) {
    failures.push(`${rel}: exercises but no transport dock to hand a tempo to`);
  }

  let exIndex = 0;
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (n.type === 'tempo') {
      // Orphan check: a handoff with no play button after it belongs to nothing.
      if (!nodes[i + 1] || nodes[i + 1].type !== 'play') {
        failures.push(`${rel}: a tempo-handoff button is not followed by a play button (orphan at offset ${n.at})`);
      }
      continue;
    }
    exercises++;
    exIndex++;
    const where = `${rel} exercise ${exIndex}`;
    let spec;
    try {
      spec = JSON.parse(unescapeAttr(n.spec));
    } catch (e) {
      failures.push(`${where}: play button data-spec is not readable JSON (${e.message})`);
      continue;
    }
    const prev = nodes[i - 1];
    const handoff = prev && prev.type === 'tempo' ? prev : null;
    const ts = String(spec.timeSignature || '').trim();
    const want = offerable(ts, spec.bpm);

    // 1 — presence, and absence, both asserted
    if (!want) {
      const why = (spec.bpm < dockMin || spec.bpm > dockMax)
        ? `${spec.bpm} BPM is outside the dock's ${dockMin}-${dockMax}`
        : `${ts || '(no signature)'} has no quarter-note beat the dock can count`;
      if (handoff) {
        failures.push(`${where}: has a handoff button but ${why} — the dock would silently disagree with the notation`);
      } else if (spec.bpm < dockMin || spec.bpm > dockMax) omittedRange++;
      else omittedMeter++;
      continue;
    }
    if (!handoff) {
      failures.push(`${where}: ${spec.bpm} BPM in ${ts} is fully within the dock's range and meters, but there is no handoff button`);
      continue;
    }
    withHandoff++;

    if (!/\bdata-exercise-metronome\b/.test(handoff.attrs)) {
      failures.push(`${where}: tempo button has no data-exercise-metronome hook, so metronome.js will never bind it`);
    }

    // 2 + 4 + 5 — the tempo, three times over, all from the same source
    const bpm = Number(attrOf(handoff.attrs, 'data-bpm'));
    if (bpm !== spec.bpm) failures.push(`${where}: handoff offers ${bpm} BPM but the exercise plays at ${spec.bpm}`);
    if (bpm < dockMin || bpm > dockMax) failures.push(`${where}: handoff offers ${bpm} BPM, outside the dock's ${dockMin}-${dockMax}`);
    const expectLabel = `Metronome ${spec.bpm}`;
    if (handoff.label !== expectLabel) failures.push(`${where}: visible label is "${handoff.label}", expected "${expectLabel}"`);
    const name = attrOf(handoff.attrs, 'aria-label');
    if (!name) {
      failures.push(`${where}: tempo button has no aria-label`);
    } else {
      if (!name.startsWith(handoff.label)) {
        failures.push(`${where}: accessible name "${name}" does not start with the visible label "${handoff.label}" (WCAG 2.5.3)`);
      }
      if ((name.match(/\d+/g) || []).map(Number)[0] !== spec.bpm) {
        failures.push(`${where}: accessible name "${name}" does not lead with the tempo ${spec.bpm}`);
      }
      if (!name.includes(' in ' + ts)) {
        failures.push(`${where}: handoff sets ${ts} but its name "${name}" does not say so`);
      }
    }

    // 3 — the meter value, from the dock's own option
    const beats = attrOf(handoff.attrs, 'data-beats');
    if (beats === null) failures.push(`${where}: handoff drops the meter for ${ts}`);
    else if (Number(beats) !== dockMeters[ts]) {
      failures.push(`${where}: handoff sends beats=${beats} for ${ts}; the dock's own option for ${ts} is ${dockMeters[ts]}`);
    }
  }
}

if (!exercises) {
  console.error('[check-tempo-handoff] FAIL — found no exercises at all; the scan is broken, not the site.');
  process.exit(1);
}
if (!withHandoff) {
  console.error('[check-tempo-handoff] FAIL — not one exercise carries a handoff button.');
  process.exit(1);
}
if (pagesWithDock !== pages.length) {
  failures.push(`only ${pagesWithDock} of ${pages.length} built pages carry the transport dock`);
}

if (failures.length) {
  console.error('[check-tempo-handoff] FAIL:');
  failures.slice(0, 40).forEach(f => console.error('  ' + f));
  if (failures.length > 40) console.error(`  … and ${failures.length - 40} more`);
  process.exit(1);
}
console.log(`[check-tempo-handoff] OK — ${exercises} exercises across ${pages.length} pages; ${withHandoff} hand their tempo and meter to the dock`);
console.log(`  dock read from built markup: ${dockMin}-${dockMax} BPM, meters ${Object.keys(dockMeters).join(', ')}`);
console.log(`  ${omittedRange + omittedMeter} correctly carry no button: ${omittedRange} outside the tempo range, ${omittedMeter} in a meter whose beat is not a quarter note`);
process.exit(0);
