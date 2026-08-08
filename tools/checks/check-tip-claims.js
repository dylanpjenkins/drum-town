#!/usr/bin/env node
// check-tip-claims.js — an exercise tip must not contradict its own notation.
//
// A tip is the prose a student reads at the moment of practice, inches from the
// staff. When it disagrees with the notes, the notes win the argument in the
// player's ears and the tip wins it in their head. Iteration 52 found two
// exercises whose SPEC was the bug — metal-headbang Ex 2 and rock-hybrid-grooves
// Ex 2 both played their backbeat on the & of 2 and the & of 4 while every
// sibling exercise, the lesson body and the exercise's own title said 2 and 4.
//
// This gate checks the one claim shape that is unambiguous enough to verify:
// a tip saying the snare is "on X and Y". Everything else is left to humans.
//
// It replaces a screening script that raised 6 false positives out of 13. Those
// six came in three classes, and each is handled explicitly below rather than
// hand-waved:
//
//   1. GHOST NOTES. Ghosts are also c/5, so a correct backbeat surrounded by
//      ghosts looked wrong. When any note in the bar carries accent: true, only
//      accented snares count — that is what "the snare is on 2 and 4" means on a
//      bar that also has ghost strokes.
//   2. SHUFFLES WRITTEN AS TWELVE EIGHTHS IN 4/4. Naive cumulative durations put
//      the backbeat at 2.5 and 5.5. Those bars carry an explicit `tuplets`
//      declaration that scales each note by notes_occupied / num_notes, which is
//      exactly what audit-lessons.js already does — reusing its arithmetic puts
//      the backbeat back on 2 and 4. My first attempt invented a note-count grid
//      instead and made this case worse, not better.
//   3. MULTI-BAR PHRASES. A tip that says "Bar 1 sits in regular rock time" is
//      describing one bar of several. Only the first bar is checked, and only
//      when the tip does not scope itself to some later bar.
//
// Exit 0 = every checkable claim agrees with its notation.

const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const lessonContent = require(path.join(ROOT, 'src/_data/lessonContent.js'));

const BASE = { w: 4, h: 2, q: 1, 8: 0.5, 16: 0.25, 32: 0.125 };
const SNARE = /(?:^|\+)c\/5(?:\+|$)/;

// Borrowed verbatim in spirit from tools/audit-lessons.js, whose BEAT-COUNT
// section is a committed baseline at 0 — so this arithmetic is already proven
// against all 852 exercises. Two things I got wrong on the first attempt and
// which matter: `dot` is a separate boolean, not a "." in the duration string,
// and a triplet shuffle is twelve plain 8ths PLUS a `tuplets` declaration that
// scales them. Without the tuplet scaling a shuffle backbeat reads as 2.5.
const tickOf = n => {
  const base = BASE[n.duration];
  if (base === undefined) return null;
  return n.dot ? base * 1.5 : base;
};
const tupletAt = (tuplets, voice, idx) =>
  (tuplets || []).find(t => t.voice === voice && idx >= t.start && idx < t.start + t.length);

function beatsExpected(ts) {
  if (!ts) return null;
  const [num, den] = String(ts).split('/').map(Number);
  return num * (4 / den);
}

// Positions of every hand note, in quarter-note units from the top of the bar,
// stopping at the end of the first bar.
function firstBarPositions(ex) {
  const barTicks = ex.expectedBeats || beatsExpected(ex.timeSignature);
  if (!barTicks) return null;
  const out = []; let t = 0;
  const arr = ex.hands || [];
  for (let i = 0; i < arr.length; i++) {
    if (t >= barTicks - 1e-6) break;
    const n = arr[i];
    let tk = tickOf(n);
    if (tk === null) return null;
    const tup = tupletAt(ex.tuplets, 'hands', i);
    if (tup) tk *= tup.notes_occupied / tup.num_notes;
    out.push({ n, tick: t });
    t += tk;
  }
  return { positions: out, barTicks, bars: Math.max(1, Math.round(
    arr.reduce((sum, n, i) => {
      let tk = tickOf(n) || 0;
      const tup = tupletAt(ex.tuplets, 'hands', i);
      if (tup) tk *= tup.notes_occupied / tup.num_notes;
      return sum + tk;
    }, 0) / barTicks)) };
}

const findings = [];
let checked = 0;

for (const [slug, lesson] of Object.entries(lessonContent)) {
  (lesson.exercises || []).forEach((ex, i) => {
    const tip = ex.tip || '';
    const m = tip.match(/snare (?:is |sits |stays |still )?(?:on|lands on)\s+(\d)\s*(?:and|&|,)\s*(\d)/i);
    if (!m) return;

    const hands = ex.hands || [];
    if (!hands.length) return;

    // Class 4: the stave is not always notating the thing the tip is claiming.
    // independence-singing Ex 1 writes the SUNG pulse on the snare line — the
    // only place to put a vocalised quarter on a drum stave — while its tip's
    // "snare on 2 and 4" describes a played part it says outright is "not
    // notated above". Checking one against the other is a category error.
    if (/not notated|SUNG part|sing |vocalize/i.test(tip)) return;

    // Exercises whose claim this check cannot parse. Each is a limit of the
    // CHECKER, verified by hand on 2026-08-08 — not a defect being suppressed.
    // Shrinking this list is the work; adding to it needs a stated reason.
    const UNPARSEABLE = {
      'jazz-comping-vocab#3': 'tip lists a 4-bar melody ("snare on 1, 3" is one clause of several); the regex captures a fragment',
      'hiphop-anderson-paak#2': 'bar has ghost strokes but marks no accent:true, so the ghost filter cannot fire — see BL-078 on that convention drift',
      'metal-tech-death#1': 'meter-changing phrase (4/4 into 7/8); one timeSignature cannot describe both bars',
      'metal-metric-modulation#0': 'same, 4/4 into 5/4',
      'metal-mathcore#0': 'tip describes the 7/8 bar of a per-bar meter-shift phrase, not the 4/4 bar on this stave',
    };
    if (UNPARSEABLE[`${slug}#${i}`]) return;

    // Class 3: a tip scoped to a bar other than the first is out of scope.
    if (/\bbars?\s*([2-9])\b/i.test(tip) && !/\bbar\s*1\b/i.test(tip)) {
      const later = tip.match(/\bbars?\s*([2-9])\b/i);
      // "Bar 1 … Bar 2 …" is fine — we check bar 1. A tip that ONLY mentions a
      // later bar is describing notation this check cannot locate.
      if (!/\bbar\s*1\b/i.test(tip)) {
        findings.push({ slug, i, title: ex.title, skipped: `tip scopes itself to bar ${later[1]}` });
        return;
      }
    }

    const fb = firstBarPositions(ex);
    if (!fb) return;                                  // unparseable duration
    const beatLen = fb.barTicks / (Number(String(ex.timeSignature || '4/4').split('/')[0]) || 4);

    // Class 1: when the bar marks accents, unaccented c/5 hits are ghosts.
    const anyAccent = fb.positions.some(p => p.n.accent === true);
    const snares = fb.positions.filter(p => {
      const keys = (p.n.keys || []).join('+');
      if (!SNARE.test(keys)) return false;
      return anyAccent ? p.n.accent === true : true;
    }).map(p => +(1 + p.tick / beatLen).toFixed(3));

    checked++;
    const claimed = [Number(m[1]), Number(m[2])];
    const ok = claimed.every(c => snares.includes(c)) && snares.every(b => claimed.includes(b));
    if (!ok) findings.push({ slug, i, title: ex.title, claimed, snares, snippet: m[0], bars: fb.bars });
  });
}

const real = findings.filter(f => !f.skipped);
const skipped = findings.filter(f => f.skipped);

if (real.length) {
  console.error(`[check-tip-claims] FAIL — ${real.length} tip(s) contradict their own notation:`);
  for (const f of real) {
    console.error(`  ${f.slug}#${f.i}  ${f.title}`);
    console.error(`     tip says : "${f.snippet}"`);
    console.error(`     notation : snare on beat(s) ${f.snares.join(', ') || '(none)'}`);
  }
  console.error(`\n  Decide WHICH SIDE IS WRONG before editing. If every sibling exercise, the`);
  console.error(`  lesson body and the exercise title agree with the tip, the SPEC is the bug and`);
  console.error(`  editing the tip would launder it into the teaching. Changing a spec changes`);
  console.error(`  what the site plays, so it needs more evidence than a prose fix, not less.`);
  process.exit(1);
}
console.log(`[check-tip-claims] OK — ${checked} checkable "snare on X and Y" claim(s) agree with their notation` +
  (skipped.length ? `; ${skipped.length} skipped (tip scoped to a later bar)` : ''));
process.exit(0);
