#!/usr/bin/env node
// check-staff-positions.js — no lesson may name a staff position the renderer
// does not draw, and no two lessons may name different ones for the same voice.
//
// BL-087. `reading-101` — the lesson that teaches reading — told beginners the
// snare was "on the middle line". It is in the middle SPACE, and the middle line
// is the one place on this stave where no drum is ever written, so the lesson
// that teaches the staff pointed at the only empty position on it. Two lessons
// away, `the-drum-kit` had said "the middle space, third from the bottom" since
// iteration 58. A reader who did both got two different answers and nothing to
// tell them which to trust.
//
// ---------------------------------------------------------------------------
// WHERE THE TABLE COMES FROM
//
// It is MEASURED, every run, from SVG this file renders through the real
// notation renderer. Nothing here transcribes a table someone read off a
// screenshot; hard-coding the y values is exactly how a wrong table would
// certify wrong prose forever. What IS hard-coded is the English — which phrase
// names which position — and that is the part a human can audit by counting
// lines on a stave.
//
// THE OFF-BY-ONE TRAP, and why the calibration below is not decoration.
// A notehead's `<path d="M x y ...">` origin is NOT the notehead's centre. For a
// round head the M sits 5.054 units ABOVE centre; for an x head (`.../x2`) it
// sits 4.015 units BELOW it. A method that reads the raw M y is therefore not
// merely off by half a space, it is off by half a space IN OPPOSITE DIRECTIONS
// for the two glyph families — and half a stave space is exactly one staff
// position. Do that and the snare "moves" onto the middle line, the
// currently-correct lesson looks like the bug, and the fix inverts.
//
// The defence is a ruler VexFlow draws itself. `c/4` sits on the first ledger
// line below the stave and `a/5` on the first ledger line above, and VexFlow
// emits both ledger lines as their own paths. A correct method puts the
// notehead's INK CENTRE exactly on them. calibrate() renders all four of c/4,
// a/5, c/4/x2 and a/5/x2 — both glyph families, both directions — and aborts the
// run if any centre misses its ledger line by more than a hundredth of a unit.
// If this file ever starts measuring the wrong thing it stops rather than lying.
//
// The stave lines are read from the same markup rather than assumed, so a change
// to stave height or origin re-derives the table instead of silently shifting
// every claim by a position.
//
// ---------------------------------------------------------------------------
// WHAT IS ASSERTED
//
//   1. POSITION CLAIMS. "<voice> ... <position phrase>" inside one clause —
//      "Snare — the middle space", "kick in the bottom space", "Mid tom · 4th
//      line". The named position must be where the renderer draws that key.
//   2. ORDERING CLAIMS. "<voice A> <verb> above|below <voice B>" in a sentence
//      explicitly about the notation, with both gaps short enough that the
//      subject is not a guess. A collective ("the toms") must satisfy the
//      relation for EVERY member — which is what catches reading-101's "Toms sit
//      between snare and hi-hat", true of the rack toms and false of the floor
//      tom.
//   3. THE EMPTY MIDDLE LINE. No exercise may put a drum voice on the middle
//      line. This is the invariant that makes "snare on the middle line" a bug
//      rather than a quibble, and reading-101 now teaches it. Visible RESTS are
//      drawn there (`restKey` defaults to b/4) and are not a drum voice;
//      reading-rests Ex 3 depends on that and is correct.
//   4. COVERAGE FLOOR, so a refactor cannot quietly stop reading the corpus and
//      report a green zero.
//   5. THE "<voice> LINE" IDIOM, WHERE IT IS A CLAIM. Added under BL-123. An
//      unqualified "the hi-hat line" names a position by naming a voice, so it
//      is checked against the EXERCISE rather than against the voice's usual
//      home: the stave must draw something at that position. Only fires when
//      note (a)'s own test is met — the sentence pairs the phrase with a
//      concrete key or the verb "notated". Three sentences in the corpus meet
//      it; the other 43 uses of the idiom stay invisible, as they should.
//
// ---------------------------------------------------------------------------
// WHAT STAYS GREEN THAT ARGUABLY SHOULD NOT — read this before trusting a pass.
//
// Mutation-tested at iteration 72 against 22 constructed defects: 20 caught, 2
// controls correctly green, 0 silent passes. Five attack the GEOMETRY rather
// than the prose (raw path origin uncorrected; origin + 5.054; the ink top; the
// ink bottom; every centre shifted one whole position) and all five are stopped
// by calibrate() before a single claim is read. One attacks the ENGLISH table
// (note g) by remapping "middle space" onto the middle line, and takes 6 claims
// down with it.
//
// RE-RUN at iteration 77 after BL-123 added rule 5, against 37 cases: 28 caught,
// 9 correctly green (the baseline, 7 controls and one documented hole), 0 silent
// passes. The iteration-72 harness was not kept in the repo, so the suite was
// rebuilt from the classes this header describes — the five geometry attacks and
// the minY+5.054 control all behave as recorded above, and four more attack the
// English table. The four findings worth writing down:
//
//   * DELETING RULE 5 ENTIRELY passed against a floor of 35, because rule 5
//     contributes exactly 3 claims and the gap was exactly 3. The floor is 36
//     now and the mutant fails.
//   * REDUCING RULE 5 TO A TAUTOLOGY (`INDEX[p.key] === p.index`, which is where
//     p.index came from) passed against the whole corpus, because all three
//     voice-line sentences are true today. That is what selfTestRule5 exists
//     for; it runs the real comparison against a constructed stave every run.
//   * DROPPING THE NOTATION TRIGGER passes against the corpus at 53 claims
//     across 22 lessons, all true — so the 43 idioms, read literally, happen to
//     be right about their own staves. The trigger stays because that is luck
//     rather than a property, and the self-test now fails without it.
//   * REMOVING RULE 3 — the empty-middle-line scan — passed everything. Nothing
//     in the corpus is on the middle line, so the rule's output is an empty map
//     whether it ran or not, and no floor counted its work. It now counts the
//     noteheads it examines (MIDDLE_LINE_SCAN_FLOOR) and asserts its own premise
//     (that b/4 is the middle line) rather than assuming it.
//
// FROM_TOP re-basing ("the second space from the top") has ZERO corpus
// instances, so inverting its arithmetic is a silent pass. That branch is
// untested by anything but reading.
//
// ONE MUTATION THAT SHOULD *NOT* FAIL, recorded because it looks like a hole and
// is not. Patching `centre` to `span.minY + 5.054` — the ink TOP plus a constant
// — leaves this gate green, and correctly: every notehead VexFlow emits here is
// exactly 10.108 units tall, x heads and round heads alike, so half the height
// IS 5.054 and `minY + 5.054` lands on the true centre for every key probed. It
// injects no defect. The wrong method is the RAW PATH ORIGIN plus 5.054, which is
// right for round heads and puts c/4/x2 at 117.069 against a ledger line at 108
// — 9.069 units, 1.81 staff positions — and is caught. The two differ only in
// which number the constant is added to, which is exactly why the trap is worth
// this paragraph.
//
// The list below is what the harness could NOT make fail, or made fail for the
// wrong reason. It is the honest list, not the flattering one.
//
//   a. THE BARE `<voice> line` IDIOM IS MOSTLY INVISIBLE, ON PURPOSE. "the snare
//      line", "a busy kick line", "no gap in the hat line" — 53 sentences across
//      34 lessons. In drum writing "line" there means PART, the way "bass line"
//      does, and none of them names a line of the stave. 43 of them carry no
//      key and no "notated" and are still invisible: rule 5's VOICE_LINE table
//      is consulted only when NOTATION_TRIGGER matches the sentence, so the
//      idiom is promoted by the test below rather than by a list of slugs.
//
//      REVISED UNDER BL-123. The paragraph that used to stand here said the
//      parser "cannot see them because a position phrase must carry a
//      qualifier", and treated that as structural. It was a gap: the very next
//      paragraph defines a test that three UNQUALIFIED sentences pass, and the
//      qualifier requirement meant they were never resolved. Rule 5 resolves
//      them now — limb-substitution#1's "notated on the hat-foot line" and
//      polyrhythms-3-2#3's "notated on the floor-tom line" — and checks each
//      against its own exercise. Both are TRUE today.
//      "Snare and hat-foot LINE UP" is excluded by a lookahead, not by luck.
//
//      THERE WERE THREE. The third was three-limb-patterns#4's "Ride quarters
//      (notated on the hi-hat line — read it as the ride)", true only because
//      BL-099 had not reached that exercise; this note predicted that moving the
//      ride to the top line would make the sentence false and rule 5 would say
//      so. BL-099 chunk 2 reached it at iteration 78 and the sentence was deleted
//      rather than left to fail, which is the correct outcome and not a test of
//      the prediction. Rule 5 now contributes 2 claims, not 3.
//
//      THE LINE BETWEEN IDIOM AND CLAIM, since it is not obvious: a sentence is
//      a POSITION CLAIM when it pairs "line" or "space" with either a concrete
//      key or the verb "notated" in a notation context. Four sentences met that
//      test and were fixed under BL-087 rather than exempted —
//      metal-quarter-bass's "Both kicks are notated on the same line (f/4)"
//      (under an <h2>Notation Note</h2>, with "notated" AND the key bolted to
//      "line", while f/4 renders in a space), and "notated on the snare line"
//      in rock-cross-stick, hiphop-r-and-b-basic and transcription-method. All
//      four now name the space and are checked by rule 1. The remaining 53 are
//      possessives with no key and no "notated", and they stay.
//
//      What rule 5 does NOT do is bind the phrase to a SUBJECT. Reading
//      limb-substitution#1's "The hi-hat 8ths are now in the FOOT (notated on
//      the hat-foot line)" as "hi-hat is on the hat-foot line" reports a
//      contradiction in a sentence that is correct, so rule 1 skips any position
//      phrase that names its own voice (note f). The cost is that "the snare is
//      notated on the ride line", with a ride actually on the stave, passes rule
//      5 and is invisible to rule 1.
//   b. BARE "above the staff" / "below the staff" ARE NOT PARSED. On this site
//      the phrase has two meanings: a staff POSITION (the crash, the hi-hat
//      foot) and a CHART REGION (reading-complex-charts' "a rhythmic line
//      written above the staff that the band hits in unison" — correct
//      big-band convention, and about the kick, which renders in the bottom
//      space). Parsing it would fail that true sentence, so only the exact
//      phrases "the space above/below the staff" and "the added line above the
//      staff" resolve. Costs the-drum-kit's "Hi-hat foot · below the staff"
//      label and hi-hat-articulation's "notated below the staff"; both are true.
//   c. VAGUE SPATIAL PROSE PASSES. "hi-hat / ride at the top", "floor tom near
//      the bottom", "hat quarters above". They name no position, so there is
//      nothing to contradict.
//   d. ORDERING NEEDS A NOTATION WORD IN THE SENTENCE, and "line" and "space"
//      are deliberately NOT notation words for this test. With them in,
//      funk-the-meters-intro's "fills the space between with ghost notes" parsed
//      as a staff relation between the snare, the kick and the hi-hat and came
//      out green by luck. The cost is that a genuine ordering error phrased
//      without the word "staff" or "notated" is invisible.
//   e. ANAPHORIC ORDERING IS UNREADABLE, AND THIS IS THE BIGGEST HOLE.
//      rock-tom-grooves used to say "the snare voice ..., but most of the
//      rhythmic activity sits below THAT, on the high tom" — the subject of
//      "below" is the activity and "that" is the snare, so the claim is the
//      REVERSE of the word order, and it was false. An earlier draft read it as
//      "snare below high tom" and printed ok on a wrong sentence, which is worse
//      than silence; the adjacency windows now refuse it instead. Measured
//      honestly: restore that sentence with COVERAGE_FLOOR set to 0 and this
//      gate reports 0 contradictions. What catches the regression in practice is
//      the floor — the rewrite's four position claims vanish with it, 35 drops
//      to 31 — and a floor is a tripwire, not a reading. Do not mistake case 3
//      of the mutation harness for semantic coverage.
//   f. ONE VOICE PER POSITION. A position binds to the voice named before it,
//      and only when exactly one is. Reading FORWARD from the position instead
//      was tried and is worse: "the crash RIDES on an added line over the top of
//      the staff" puts the ride cymbal's name between the crash and its position
//      and fails a true sentence. The cost is that a clause naming two voices
//      ahead of one position is skipped rather than guessed.
//   g. THE TABLE IS DERIVED, THE ENGLISH IS NOT. If POSITIONS below mapped
//      "middle space" to the wrong index this gate would enforce that error
//      corpus-wide. That mapping is the one thing here a reviewer must check by
//      hand, which is why it is a short table with the arithmetic beside it.
//   h. STEM DIRECTION IS NOT CHECKED AT ALL. A staff position is only half of
//      what identifies a drum voice on the page; the other half is which way the
//      stem points, which is how a reader tells a hands voice from a feet voice
//      when both are near the bottom of the stave. Nothing here reads it. Two
//      consequences. Prose side: reading-101's "kick in the bottom space, stems
//      pointing down" and the-drum-kit's "Bass drum — the bottom space, stem
//      down" have their POSITION verified and their STEM claim taken on trust.
//      Spec side: the renderer assigns stems by VOICE, not by key — everything
//      in `hands` gets VF.Stem.UP and everything in `feet` VF.Stem.DOWN — so a
//      note written into the wrong voice renders at the right height with the
//      wrong stem, and this gate sees nothing wrong with it. That is not
//      hypothetical: playing-to-a-song#3 carries the corpus's only f/4 in a
//      `hands` array — 1 of 2345 — chorded against the crash, so it draws
//      stem-up while every other kick on the site draws stem-down. Position
//      checking cannot find that class of defect; a stem gate is a separate
//      file, and that exercise is filed as its own backlog item.
//
// Exit 0 = every readable claim agrees with the rendered geometry.
// `--survey` prints every parsed claim and its verdict without failing.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const lessonContent = require(path.join(ROOT, 'src/_data/lessonContent.js'));
const { renderPattern } = require(path.join(ROOT, 'tools/notation-renderer.js'));

const SURVEY = process.argv.includes('--survey');

// Set at iteration 72, when the parser read 35 claims across the 7 lessons that
// name a staff position in prose:
//
//   the-drum-kit          20   the drum key twice over — 8 labels inside the
//                              staff diagram, 9 items in the ordered list under
//                              it, and 3 more in the surrounding prose
//   reading-101            7   after BL-087
//   rock-tom-grooves       4   after BL-087
//   metal-quarter-bass     1   after BL-087
//   rock-cross-stick       1   after BL-087
//   hiphop-r-and-b-basic   1   after BL-087
//   transcription-method   1   after BL-087
//
// Raised to 36 at iteration 77, when rule 5 added three more across three more
// lessons: 38 claims across 10 lessons. The gap was 2 rather than 3 on purpose:
// rule 5 contributed exactly 3, so a floor of 35 let the whole rule be deleted
// and still pass.
//   three-limb-patterns    1   BL-123 rule 5   <- deleted at iteration 78
//   limb-substitution      1   BL-123 rule 5
//   polyrhythms-3-2        1   BL-123 rule 5
//
// NOW 37 ACROSS 9 LESSONS, and the floor stays at 36 because a floor is a
// ratchet and lowering it is how coverage erodes quietly. BL-099 chunk 2 fixed
// three-limb-patterns#4's notation and deleted the sentence that described the
// old one ("Ride quarters (notated on the hi-hat line — read it as the ride)"),
// so rule 5 now contributes 2 and the whole rule is still not deletable in
// silence: 37 − 2 = 35, below the floor.
//
// A gate that quietly stops looking is worse than one that fails, so a drop
// below this is a failure even when nothing contradicts. State the cost plainly:
// the gap is now ONE claim, not two, so the next reworded position sentence
// anywhere in the corpus trips this floor and has to be looked at rather than
// waved through. That is uncomfortable and it is the intended direction. Note
// that the-drum-kit alone is 20 of the 37, so rewording its drum key trips the
// floor even when the rewording is correct.
const COVERAGE_FLOOR = 36;

function die(msg) { console.error(`[check-staff-positions] FAIL — ${msg}`); process.exit(1); }

// ===========================================================================
// GEOMETRY — measured, not assumed.
// ===========================================================================

// Exact extremes of a bezier along one axis. The control hull over-reports by
// several units on real glyph outlines, and a centre taken from a hull is not
// the notehead's centre.
function cubicSpan(p0, p1, p2, p3) {
  let lo = Math.min(p0, p3), hi = Math.max(p0, p3);
  const a = 3 * (-p0 + 3 * p1 - 3 * p2 + p3);
  const b = 6 * (p0 - 2 * p1 + p2);
  const c = 3 * (p1 - p0);
  const ts = [];
  if (Math.abs(a) < 1e-12) { if (Math.abs(b) > 1e-12) ts.push(-c / b); }
  else {
    const d = b * b - 4 * a * c;
    if (d >= 0) { const s = Math.sqrt(d); ts.push((-b + s) / (2 * a), (-b - s) / (2 * a)); }
  }
  for (const t of ts) {
    if (!(t > 0 && t < 1)) continue;
    const u = 1 - t;
    const v = u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [lo, hi];
}
function quadSpan(p0, p1, p2) {
  let lo = Math.min(p0, p2), hi = Math.max(p0, p2);
  const den = p0 - 2 * p1 + p2;
  if (Math.abs(den) > 1e-12) {
    const t = (p0 - p1) / den;
    if (t > 0 && t < 1) {
      const u = 1 - t;
      const v = u * u * p0 + 2 * u * t * p1 + t * t * p2;
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  return [lo, hi];
}
const ARGC = { M: 2, L: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, T: 2, A: 7, Z: 0 };
function pathYSpan(d) {
  const toks = d.match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?/g) || [];
  let cx = 0, cy = 0, sx = 0, sy = 0, cmd = null, i = 0, rcy = null;
  let minY = Infinity, maxY = -Infinity;
  const pt = y => { if (y < minY) minY = y; if (y > maxY) maxY = y; };
  while (i < toks.length) {
    if (/[A-Za-z]/.test(toks[i])) {
      cmd = toks[i]; i++;
      if (cmd === 'Z' || cmd === 'z') { cx = sx; cy = sy; continue; }
    }
    if (cmd === null) { i++; continue; }
    const up = cmd.toUpperCase(), rel = cmd !== up, n = ARGC[up];
    if (n === undefined) { i++; continue; }
    const a = [];
    for (let k = 0; k < n; k++) a.push(parseFloat(toks[i + k]));
    if (a.some(Number.isNaN)) break;
    i += n;
    const AX = v => (rel ? cx + v : v), AY = v => (rel ? cy + v : v);
    let nx = cx, ny = cy;
    if (up === 'M') { nx = AX(a[0]); ny = AY(a[1]); sx = nx; sy = ny; pt(ny); cmd = rel ? 'l' : 'L'; }
    else if (up === 'L') { nx = AX(a[0]); ny = AY(a[1]); pt(cy); pt(ny); }
    else if (up === 'H') { nx = AX(a[0]); pt(cy); }
    else if (up === 'V') { ny = AY(a[0]); pt(cy); pt(ny); }
    else if (up === 'C') {
      const y1 = AY(a[1]), y2 = AY(a[3]); nx = AX(a[4]); ny = AY(a[5]);
      const ys = cubicSpan(cy, y1, y2, ny); pt(ys[0]); pt(ys[1]); rcy = y2;
    } else if (up === 'S') {
      const y1 = rcy === null ? cy : 2 * cy - rcy;
      const y2 = AY(a[1]); nx = AX(a[2]); ny = AY(a[3]);
      const ys = cubicSpan(cy, y1, y2, ny); pt(ys[0]); pt(ys[1]); rcy = y2;
    } else if (up === 'Q') {
      const y1 = AY(a[1]); nx = AX(a[2]); ny = AY(a[3]);
      const ys = quadSpan(cy, y1, ny); pt(ys[0]); pt(ys[1]);
    } else if (up === 'T' || up === 'A') {
      nx = AX(a[n - 2]); ny = AY(a[n - 1]); pt(cy); pt(ny);
    }
    if (up !== 'C' && up !== 'S') rcy = null;
    cx = nx; cy = ny;
  }
  return { minY, maxY };
}

// One note on an otherwise empty bar. Returns the stave-line y values, any
// ledger lines VexFlow drew, and the notehead's ink centre.
//
// `soft` returns null instead of aborting, for keys that arrive from the corpus
// rather than from this file's own vocabulary: a spec may name a key the player
// has never mapped (that is check-player-keys' job to fail on) or one VexFlow
// cannot draw at all, and neither should turn this gate into a crash report.
function probe(key, soft) {
  const bail = msg => { if (soft) return null; die(msg); };
  const svg = renderPattern({ timeSignature: '4/4', hands: [{ keys: [key], duration: 'w' }] });
  if (/notation-error/.test(svg)) return bail(`the renderer could not draw a probe note for ${key}`);
  const staveG = /<g class="vf-stave"[\s\S]*?<\/g>/.exec(svg);
  if (!staveG) return bail('no <g class="vf-stave"> in the probe render; the renderer markup has changed');
  const staveLines = [...staveG[0].matchAll(/\sd="M[-\d.]+ ([-\d.]+)L/g)].map(m => Number(m[1]));
  if (staveLines.length !== 5) return bail(`expected 5 stave lines in the probe render, measured ${staveLines.length}`);
  const headG = /<g class="vf-notehead"[\s\S]*?<\/g>/.exec(svg);
  if (!headG) return bail(`no notehead drawn for probe key ${key}`);
  const dm = /<path[^>]*\sd="([^"]*)"/.exec(headG[0]);
  if (!dm) return bail(`the notehead for ${key} carries no path data`);
  const span = pathYSpan(dm[1]);
  if (!Number.isFinite(span.minY) || !Number.isFinite(span.maxY)) return bail(`could not measure the ${key} notehead`);
  // Ledger lines: VexFlow draws them inside the stavenote group at stroke-width 1.4.
  const ledgers = [...svg.matchAll(/<path stroke-width="1\.4" fill="none"[^>]*\sd="M[-\d.]+ ([-\d.]+)L/g)]
    .map(m => Number(m[1]));
  return { key, staveLines, ledgers, centre: (span.minY + span.maxY) / 2 };
}

// CALIBRATION. Both glyph families are probed because their path origins are
// displaced in OPPOSITE directions, so a method that reads the origin passes one
// family and fails the other.
function calibrate() {
  const notes = [];
  for (const key of ['c/4', 'a/5', 'c/4/x2', 'a/5/x2']) {
    const p = probe(key);
    if (p.ledgers.length !== 1) {
      die(`calibration: expected exactly 1 ledger line for ${key}, VexFlow drew ${p.ledgers.length}. ` +
        'The ruler this file calibrates against is gone; do not trust the table.');
    }
    if (Math.abs(p.centre - p.ledgers[0]) > 0.01) {
      die(`calibration: the ${key} notehead centre measured ${p.centre.toFixed(3)} but VexFlow drew its ` +
        `ledger line at ${p.ledgers[0]}. A half-space error here is exactly one staff position, and it is ` +
        'how "snare on the middle line" gets certified correct. Refusing to measure.');
    }
    notes.push(`${key}@${p.centre.toFixed(3)}=ledger ${p.ledgers[0]}`);
  }
  return notes;
}
const calibration = calibrate();

// The five stave lines, and the half-space step that indexes every position.
const STAVE = probe('c/5').staveLines.slice().sort((a, b) => a - b);   // top .. bottom
const TOP_LINE = STAVE[0], BOTTOM_LINE = STAVE[4];
const SPACING = (BOTTOM_LINE - TOP_LINE) / 4;
const STEP = SPACING / 2;
if (!(SPACING > 0)) die('the probe stave has no measurable line spacing');

// Position index: 0 = bottom line, +1 per half space upward. So 1 = the bottom
// space, 8 = the top line, 9 = the space above it, 10 = the first ledger above,
// -1 = the space below the stave.
const idxOf = y => (BOTTOM_LINE - y) / STEP;

// The English. THIS is the hand-checkable part: every entry pairs a phrase a
// lesson might write with the index it must mean. Count the lines on a stave to
// audit it. Longest phrase first — "space above the top line" must not be eaten
// by "top line".
const POSITIONS = [
  [/\bspace\s+(?:just\s+|immediately\s+)?above\s+the\s+(?:top|fifth|5th)\s+line\b/i, 9, 'the space above the top line'],
  [/\bspace\s+(?:just\s+|immediately\s+)?above\s+the\s+(?:staff|stave)\b/i, 9, 'the space above the staff'],
  [/\bspace\s+(?:just\s+|immediately\s+)?below\s+the\s+(?:staff|stave)\b/i, -1, 'the space below the staff'],
  [/\b(?:first|1st)\s+(?:added|ledger|leger)\s+line\s+above\b/i, 10, 'the first ledger line above'],
  [/\b(?:added|ledger|leger|extra)\s+line\s+(?:just\s+)?(?:above|over)\b/i, 10, 'the added line above the staff'],
  [/\b(?:top|highest|upper(?:most)?)\s+space\b/i, 7, 'the top space'],
  [/\b(?:bottom|lowest)\s+space\b/i, 1, 'the bottom space'],
  // Four spaces have no strict middle. "Middle space" is the corpus's name for
  // the snare's, and the-drum-kit disambiguates it in the same breath ("the
  // middle space, third from the bottom"). Mapping it anywhere else would make
  // that lesson wrong, and it was verified against real geometry at iteration 58.
  [/\bmiddle\s+space\b/i, 5, 'the middle space'],
  [/\b(?:fourth|4th)\s+space\b/i, 7, 'the fourth space'],
  [/\b(?:third|3rd)\s+space\b/i, 5, 'the third space'],
  [/\b(?:second|2nd)\s+space\b/i, 3, 'the second space'],
  [/\b(?:first|1st)\s+space\b/i, 1, 'the first space'],
  [/\b(?:top|highest)\s+line\b/i, 8, 'the top line'],
  [/\b(?:bottom|lowest)\s+line\b/i, 0, 'the bottom line'],
  [/\b(?:middle|centre|center)\s+line\b/i, 4, 'the middle line'],
  [/\b(?:fifth|5th)\s+line\b/i, 8, 'the fifth line'],
  [/\b(?:fourth|4th)\s+line\b/i, 6, 'the fourth line'],
  [/\b(?:third|3rd)\s+line\b/i, 4, 'the third line'],
  [/\b(?:second|2nd)\s+line\b/i, 2, 'the second line'],
  [/\b(?:first|1st)\s+line\b/i, 0, 'the first line'],
];
// THE BARE "<voice> line" IDIOM, and the one shape of it that IS a claim.
//
// BL-123. Note (a) below is right that "the snare line", "a busy kick line" and
// "no gap in the hat line" mean PART, the way "bass line" does, and that 43 of
// them across the corpus name no line of any stave. It was wrong that the parser
// therefore could not see any of them: note (a) itself sets the test — a
// sentence is a POSITION CLAIM when it pairs "line" or "space" with a concrete
// key or the verb "notated" — and three sentences met that test with an
// UNQUALIFIED voice name, so positionsIn() never resolved them at all. Two are
// left; the third, three-limb-patterns#4's "Ride quarters (notated on the hi-hat
// line — read it as the ride)", was BL-099 admitting its bug in writing and went
// with the fix at iteration 78:
//
//   limb-substitution#1    "The hi-hat 8ths are now in the FOOT (notated on
//                           the hat-foot line)"
//   polyrhythms-3-2#3      "2-pulse on the floor tom (notated on the floor-tom
//                           line, but played with your feet ...)"
//
// These entries give the phrase a position: the one the RENDERER draws that
// voice on. They are consulted by rule 5 only, never by rule 1 — see the
// `voiceNamed` guard there, and the reasoning under it.
const VOICE_LINE = [
  ['hi-hat foot', 'd/4/x2'], ['hat-foot', 'd/4/x2'], ['hat foot', 'd/4/x2'], ['hi-hat pedal', 'd/4/x2'],
  ['floor tom', 'a/4'], ['floor-tom', 'a/4'],
  ['high tom', 'e/5'], ['high-tom', 'e/5'], ['hi-tom', 'e/5'], ['rack tom', 'e/5'],
  ['mid tom', 'd/5'], ['mid-tom', 'd/5'],
  ['bass drum', 'f/4'], ['kick drum', 'f/4'], ['kick', 'f/4'],
  ['hi-hat', 'g/5/x2'], ['hihat', 'g/5/x2'], ['hat', 'g/5/x2'],
  ['cross-stick', 'c/5'], ['snare', 'c/5'],
  ['ride', 'f/5/x2'], ['cowbell', 'e/5/x2'], ['bell', 'e/5/x2'],
  ['crash', 'a/5/x2'], ['china', 'b/5/x2'],
];
// "Snare and hat-foot LINE UP" is a phrasal verb, not a staff position, and
// four-way-foundation#1 says it twice.
const voiceLineRe = word =>
  new RegExp('\\bthe\\s+' + word.replace(/[-\s]/g, '[-\\s]') + '[-\\s]lines?\\b(?!\\s+up\\b)', 'i');

// The BL-087 trigger, quoted from note (a): "line" is a claim when the sentence
// pairs it with a concrete key or the verb "notated". Nothing else promotes the
// idiom, which is why the other 43 stay invisible.
const NOTATION_TRIGGER = /\bnotat\w+|\bwritten\b|\bwrites\b|\b[a-g]\/\d(?:\/x2)?\b/i;

const FROM_TOP = /^\s*(?:down\s+)?from\s+the\s+top\b/i;
const NTH = new Map([['first', 1], ['1st', 1], ['second', 2], ['2nd', 2], ['third', 3], ['3rd', 3],
  ['fourth', 4], ['4th', 4], ['fifth', 5], ['5th', 5]]);

function positionsIn(clause, sentence) {
  const out = [];
  // Unqualified "the <voice> line", promoted only under the BL-087 trigger.
  // Longest name first so "the hat-foot line" is not read as "the hat line".
  if (sentence !== undefined && NOTATION_TRIGGER.test(sentence)) {
    for (const [word, key] of VOICE_LINE) {
      const m = voiceLineRe(word).exec(clause);
      if (!m) continue;
      if (out.some(p => p.at <= m.index && p.at + p.text.length >= m.index + m[0].length)) continue;
      out.push({ index: INDEX[key], label: `the ${word} line`, at: m.index, text: m[0], voiceNamed: word, key });
    }
  }
  for (const [re, idx, label] of POSITIONS) {
    const m = re.exec(clause);
    if (!m) continue;
    let index = idx, label2 = label;
    // "the second space FROM THE TOP" is the third from the bottom. Only ordinal
    // phrases can be re-based; "the top line from the top" is not English.
    const ord = /\b(first|1st|second|2nd|third|3rd|fourth|4th|fifth|5th)\s+(line|space)\b/i.exec(m[0]);
    if (ord && FROM_TOP.test(clause.slice(m.index + m[0].length))) {
      const n = NTH.get(ord[1].toLowerCase());
      index = ord[2].toLowerCase() === 'line' ? 8 - (n - 1) * 2 : 7 - (n - 1) * 2;
      label2 = `${label} from the top`;
    }
    out.push({ index, label: label2, at: m.index, text: m[0] });
  }
  // Overlapping matches ("space above the top line" also matches "top line"):
  // keep the longest at each site.
  return out.filter(p => !out.some(q => q !== p && q.at <= p.at
    && q.at + q.text.length >= p.at + p.text.length && q.text.length > p.text.length));
}

function nameIndex(i) {
  if (i % 2 === 0) {
    const n = i / 2 + 1;                                     // 1 = bottom line
    if (n >= 1 && n <= 5) {
      return `the ${['first', 'second', 'third', 'fourth', 'fifth'][n - 1]} line` +
        (n === 5 ? ' (the top line)' : n === 3 ? ' (the middle line)' : n === 1 ? ' (the bottom line)' : '');
    }
    return n > 5 ? `ledger line ${n - 5} above the staff` : `ledger line ${1 - n} below the staff`;
  }
  const n = (i - 1) / 2 + 1;                                 // 1 = bottom space
  if (n >= 1 && n <= 4) {
    return `the ${['first', 'second', 'third', 'fourth'][n - 1]} space` +
      (n === 3 ? ' (the middle space)' : n === 4 ? ' (the top space)' : n === 1 ? ' (the bottom space)' : '');
  }
  return n > 4 ? 'the space above the top line' : 'the space below the staff';
}

// ===========================================================================
// VOICES — key -> drum name from player.js; prose word -> key(s) here.
// ===========================================================================
const playerSrc = fs.readFileSync(path.join(ROOT, 'src/assets/js/player.js'), 'utf8');
const mapBlock = /KEY_TO_DRUM\s*=\s*\{([\s\S]*?)\}/.exec(playerSrc);
if (!mapBlock) die('KEY_TO_DRUM not found in player.js');
const KEY_TO_DRUM = {};
for (const m of mapBlock[1].matchAll(/'([^']+)'\s*:\s*'([^']+)'/g)) KEY_TO_DRUM[m[1]] = m[2];

// Longest first, so "hi-hat foot" is not eaten by "hi-hat". Several spellings map
// to one key on purpose. A COLLECTIVE carries several keys and asserts over all
// of them; it can never satisfy a single-position claim, so rule 1 skips it.
const VOICES = [
  ['hi-hat foot', ['d/4/x2']], ['hi-hat-foot', ['d/4/x2']], ['hat foot', ['d/4/x2']],
  ['hat-foot', ['d/4/x2']], ['hihat foot', ['d/4/x2']], ['foot hi-hat', ['d/4/x2']],
  ['foot-hat', ['d/4/x2']], ['hi-hat pedal', ['d/4/x2']],
  ['cross-stick', ['c/5']], ['cross stick', ['c/5']],
  ['floor tom', ['a/4']], ['floor-tom', ['a/4']],
  ['high tom', ['e/5']], ['hi tom', ['e/5']], ['hi-tom', ['e/5']], ['high-tom', ['e/5']],
  ['rack tom', ['e/5']],
  ['mid tom', ['d/5']], ['mid-tom', ['d/5']], ['middle tom', ['d/5']],
  ['bass drum', ['f/4']], ['kick drum', ['f/4']], ['kick', ['f/4']],
  ['hi-hat', ['g/5/x2']], ['hihat', ['g/5/x2']], ['hi hat', ['g/5/x2']], ['hat', ['g/5/x2']],
  ['snare', ['c/5']],
  ['ride', ['f/5/x2']],
  ['cowbell', ['e/5/x2']],
  ['crash', ['a/5/x2']],
  ['china', ['b/5/x2']],
  // Collective. "Toms sit between snare and hi-hat" has to hold for the floor
  // tom too, and it does not — which is half of the BL-087 defect.
  ['tom', ['e/5', 'd/5', 'a/4']],
];
const VOICE_WORDS = new Set(VOICES.map(([w]) => w));

// Measure every key the player knows about. A key nothing uses is still probed:
// prose may name a voice no exercise has drawn yet, and the position is a
// property of the renderer, not of the corpus.
const CENTRE = {};
for (const key of Object.keys(KEY_TO_DRUM)) CENTRE[key] = probe(key).centre;

const INDEX = {};
for (const [key, y] of Object.entries(CENTRE)) {
  const i = idxOf(y);
  if (Math.abs(i - Math.round(i)) > 1e-6) {
    die(`${key} measured at y=${y}, which is ${i.toFixed(3)} half-spaces off the bottom line — not a ` +
      'staff position at all. The probe or the renderer has changed shape.');
  }
  INDEX[key] = Math.round(i);
}
for (const [, keys] of VOICES) {
  for (const k of keys) if (INDEX[k] === undefined) die(`voice vocabulary names ${k}, which player.js does not map`);
}
for (const [word, k] of VOICE_LINE) {
  if (INDEX[k] === undefined) die(`the "<voice> line" table names ${k} for "${word}", which player.js does not map`);
}
const label = keys => keys.map(k => KEY_TO_DRUM[k]).join('/');

// ===========================================================================
// THE CORPUS
// ===========================================================================
// Block boundaries are sentence boundaries. Without this the drum key's <li>
// items run into one another and every voice ends up in the previous item's
// clause — which is how an earlier draft parsed 0 of the-drum-kit's 9 key lines.
// <tspan> is NOT a boundary: "Snare<tspan>· 3rd space</tspan>" is one label.
const plain = s => String(s || '')
  .replace(/<\/(?:p|li|ul|ol|h[1-6]|text|figcaption|div|td|tr|blockquote)>/gi, '. ')
  .replace(/<br\s*\/?>/gi, '. ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#39;|&rsquo;/g, "'")
  .replace(/&quot;/g, '"').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
  .replace(/\s+/g, ' ').trim();

// "not on the top line", "rather than in a space": a negated or contrastive
// claim is not a claim that the thing IS there. Consulted only on the text up to
// the END of the position phrase, so the-drum-kit's "sits on the fourth line
// RATHER THAN in a space" — an assertion followed by a contrast — still counts.
const NEGATED = /\bnot\b|\bn['’]t\b|\bnever\b|\brather than\b|\binstead of\b|\bno longer\b|\bunlike\b|\bmistake\b|\bwrongly\b/i;

// A sentence must be talking about the page before "above" is read as a
// direction on it. "line" and "space" are deliberately absent — see note (d).
//
// Tested against the sentence AND the one before it, because a paragraph that
// has established it is describing the staff keeps describing it. reading-101's
// "Toms sit between snare and hi-hat in pitch order" — the false half of the
// BL-087 defect — carries no notation word of its own; the sentence before it
// ("...hi-hat foot as an X below the staff") carries two. One sentence of
// carry-over is the whole window: it is enough for a drum-key paragraph and
// short enough that a notation paragraph cannot license the musical prose three
// sentences later.
const ABOUT_NOTATION = /\b(?:staff|stave|notat\w+|written|writes|noteheads?|note-?head|drum key|clef|score|on the page)\b/i;

const findings = [];
const survey = [];
let claims = 0;
const lessonsCovered = new Set();

// The exercise is carried alongside each field so rule 5 can compare a tip
// against its own stave. Lesson-level fields carry null and rule 5 skips them.
function fieldsOf(lesson) {
  const out = [['bodyHtml', lesson.bodyHtml, null], ['tagline', lesson.tagline, null]];
  (lesson.graduationCriteria || []).forEach((g, i) => out.push([`grad[${i}]`, g, null]));
  (lesson.exercises || []).forEach((ex, i) => {
    out.push([`ex${i}.title`, ex.title, ex], [`ex${i}.meta`, ex.meta, ex], [`ex${i}.tip`, ex.tip, ex]);
  });
  (lesson.listening || []).forEach((li, i) => out.push([`listen[${i}]`, li && li.note, null]));
  return out;
}

// Every staff position an exercise actually draws on, measured through the same
// probe the rest of this file uses. Grace notes inherit their parent's keys and
// are followed; rests are not positions anyone reads as a drum.
const corpusIndex = {};
function indexOfCorpusKey(key) {
  if (corpusIndex[key] !== undefined) return corpusIndex[key];
  if (INDEX[key] !== undefined) { corpusIndex[key] = INDEX[key]; return corpusIndex[key]; }
  const p = probe(key, true);
  if (!p) { corpusIndex[key] = null; return null; }
  const i = idxOf(p.centre);
  corpusIndex[key] = Math.abs(i - Math.round(i)) > 1e-6 ? null : Math.round(i);
  return corpusIndex[key];
}
// Rule 5's whole assertion, in one named place so the self-test below runs the
// SAME expression the corpus loop does. Inlined, it could be "simplified" to
// `INDEX[p.key] === p.index` — a tautology, since that is where p.index came
// from — and today's corpus would not notice, because all three of its
// voice-line sentences are true.
function voiceLineHolds(ex, p) { return drawnIndices(ex).has(p.index); }

function drawnIndices(ex) {
  const out = new Set();
  for (const voice of ['hands', 'feet']) {
    for (const n of ex[voice] || []) {
      if (n.rest) continue;
      const parts = [n, ...(n.grace ? (Array.isArray(n.grace) ? n.grace : [n.grace]) : [])];
      for (const part of parts) {
        for (const key of part.keys || n.keys || []) {
          const i = indexOfCorpusKey(key);
          if (i !== null) out.add(i);
        }
      }
    }
  }
  return out;
}

// SELF-TEST FOR RULE 5, on synthetic input, every run. All three of the corpus's
// voice-line sentences are TRUE, so a rule 5 that had stopped working would look
// exactly like a rule 5 that works, and neither the corpus nor the coverage
// floor would say a word. Two constructed defects and two controls, through the
// same functions the corpus loop uses.
(function selfTestRule5() {
  const claim = 'Everything here is notated on the crash line.';
  const parsed = positionsIn(claim, claim).filter(p => p.voiceNamed);
  if (parsed.length !== 1 || parsed[0].key !== 'a/5/x2') {
    die(`rule 5 self-test: "${claim}" should resolve to exactly one voice-line position on the crash, ` +
      `it resolved ${parsed.length} (${parsed.map(p => p.label).join(', ')})`);
  }
  const p = parsed[0];
  if (voiceLineHolds({ hands: [{ keys: ['c/5'], duration: 'q' }] }, p)) {
    die('rule 5 self-test: a stave holding only a snare was accepted as satisfying "the crash line". ' +
      'The assertion has been reduced to something that cannot fail.');
  }
  if (!voiceLineHolds({ hands: [{ keys: ['a/5/x2'], duration: 'q' }] }, p)) {
    die('rule 5 self-test: a stave holding a crash was rejected for "the crash line".');
  }
  const idiom = 'Keep the crash line out of it.';
  if (positionsIn(idiom, idiom).some(x => x.voiceNamed)) {
    die(`rule 5 self-test: "${idiom}" has no key and no "notated", so it is the PART idiom and must not ` +
      'resolve to a staff position. 43 sentences depend on that.');
  }
  const lineUp = 'As notated, snare and the hat-foot line up here.';
  if (positionsIn(lineUp, lineUp).some(x => x.voiceNamed)) {
    die('rule 5 self-test: "the hat-foot line up" is a phrasal verb, not a staff position.');
  }
})();

// Voices mentioned in a stretch of text, longest name first, with the guard that
// stops "hat" claiming the tail of "foot-hat" and "tom" the tail of "floor tom".
function voicesIn(text) {
  const hits = [];
  for (const [word, keys] of VOICES) {
    const re = new RegExp('\\b' + word.replace(/[-\s]/g, '[-\\s]') + '(?:e?s)?\\b', 'gi');
    let m;
    while ((m = re.exec(text))) {
      const prev = /([\w]+)[-\s]$/.exec(text.slice(0, m.index));
      if (prev && VOICE_WORDS.has(`${prev[1].toLowerCase()}-${word}`)) continue;
      if (prev && VOICE_WORDS.has(`${prev[1].toLowerCase()} ${word}`)) continue;
      if (hits.some(h => h.at <= m.index && h.at + h.text.length >= m.index + m[0].length)) continue;
      hits.push({ word, keys, at: m.index, text: m[0] });
    }
  }
  return hits.sort((a, b) => a.at - b.at);
}

// Rule 2 adjacency. The relation word must sit close enough to both voices that
// the subject is not a guess, and the gap must not contain an anaphor or a
// clause break — "sits below THAT, on the high tom" is the shape that made an
// earlier draft print ok on a wrong sentence.
const GAP_BEFORE = 34, GAP_AFTER = 22;
const GAP_POISON = /[.;:,()]|\b(?:that|this|it|which|there|the staff|the stave|but|and)\b/i;

for (const [slug, lesson] of Object.entries(lessonContent)) {
  for (const [field, raw, ex] of fieldsOf(lesson)) {
    const text = plain(raw);
    if (!text) continue;

    let prevSentence = '';
    for (const sentence of text.split(/(?<=[.;!?])\s+/)) {
      const context = `${prevSentence} ${sentence}`;
      prevSentence = sentence;
      // ---- RULE 1: position claims. One voice, one position, one clause.
      // Em dashes are NOT clause breaks here: the drum key writes "Snare — the
      // middle space", and splitting on it separates every voice from its own
      // position.
      for (const clause of sentence.split(/\s*[,;:]\s*/)) {
        const pos = positionsIn(clause, sentence);

        // ---- RULE 5: "notated on the <voice> line" must be true OF THIS
        // STAVE. The phrase names a position by naming a voice, so the thing to
        // check is not where that voice usually lives — it is whether this
        // exercise draws anything there at all. polyrhythms-3-2#3 says its
        // 2-pulse is "notated on the floor-tom line" and the stave draws a/4, so
        // it holds; move that voice and this rule says so. Its third instance,
        // three-limb-patterns#4's "notated on the hi-hat line", was the BL-099
        // defect stated in writing, and BL-099 chunk 2 removed both the notation
        // and the sentence at iteration 78.
        for (const p of pos) {
          if (!p.voiceNamed || !ex) continue;
          if (NEGATED.test(clause.slice(0, p.at + p.text.length))) continue;
          claims++;
          lessonsCovered.add(slug);
          const drawn = drawnIndices(ex);
          const ok = voiceLineHolds(ex, p);
          if (SURVEY) {
            survey.push(`${ok ? 'ok  ' : 'FAIL'} ${slug} :: ${field} [voice-line] says ${p.label} ` +
              `(${nameIndex(p.index)}), stave draws ${[...drawn].sort((a, b) => b - a).map(nameIndex).join(' / ') || 'nothing'}`);
          }
          if (!ok) {
            findings.push({
              slug, field, kind: 'voice-line', voice: KEY_TO_DRUM[p.key],
              said: `${p.label}, i.e. ${nameIndex(p.index)}`,
              real: `this stave draws only ${[...drawn].sort((a, b) => b - a).map(nameIndex).join(' / ') || 'nothing'}`,
              clause: clause.trim(),
            });
          }
        }

        if (pos.length !== 1) continue;                      // note (f)
        // "the hi-hat line" NAMES a voice, so a clause carrying it always holds
        // at least two — the subject and the one inside the phrase — and note
        // (f) refuses to guess between them. Reading the subject anyway fails a
        // true sentence: limb-substitution#1's "The hi-hat 8ths are now in the
        // FOOT (notated on the hat-foot line)" binds "hi-hat" to the hat-foot's
        // position and reports a contradiction in prose that is correct. These
        // phrases are checked by rule 5 instead, against the exercise itself.
        if (pos[0].voiceNamed) continue;
        // Only voices named BEFORE the position can be its subject. Scoping this
        // to the whole clause was a hole the mutation harness found: "the hi-hat
        // foot sits in the bottom space and lives below the staff ... similar to
        // the bass drum" was skipped as ambiguous because of a voice mentioned
        // long after the claim. Reading forward from the position instead —
        // nearest preceding voice — was tried and is worse: "the crash RIDES on
        // an added line over the top of the staff" puts the ride cymbal's name
        // between the crash and its position and fails a true sentence.
        const vs = voicesIn(clause).filter(v => v.at + v.text.length <= pos[0].at);
        const keys = [...new Set(vs.flatMap(v => v.keys))];
        if (keys.length !== 1) continue;                     // note (f); collectives too
        if (NEGATED.test(clause.slice(0, pos[0].at + pos[0].text.length))) continue;
        const key = keys[0];
        claims++;
        lessonsCovered.add(slug);
        const want = INDEX[key];
        const ok = want === pos[0].index;
        if (SURVEY) {
          survey.push(`${ok ? 'ok  ' : 'FAIL'} ${slug} :: ${field} [${KEY_TO_DRUM[key]}] says ` +
            `${pos[0].label}, renders on ${nameIndex(want)}`);
        }
        if (!ok) {
          findings.push({
            slug, field, kind: 'position', voice: KEY_TO_DRUM[key],
            said: pos[0].label, real: nameIndex(want), clause: clause.trim(),
          });
        }
      }

      // ---- RULE 2: ordering claims. Needs the sentence to be about the page.
      if (!ABOUT_NOTATION.test(context)) continue;
      if (NEGATED.test(sentence)) continue;
      const vs = voicesIn(sentence);
      if (vs.length < 2) continue;

      // "over" and "under" are NOT in this set. In drum prose they mean LAYERED,
      // not higher on the page — "ride quarters over a syncopated kick", "snare
      // 16ths over kick 16ths" — and both were parsing as staff relations and
      // coming out green by luck. Worse, "the snare can take over the ride's
      // role" (jazz-broken-time) is a phrasal verb with no spatial content at
      // all, and it parsed as a FAILURE. Only the unambiguous words survive.
      for (const m of sentence.matchAll(/\b(above|below|beneath|underneath|higher than|lower than)\b/gi)) {
        const rel = m[1].toLowerCase();
        const before = vs.filter(v => v.at + v.text.length <= m.index).pop();
        const after = vs.find(v => v.at >= m.index + m[0].length);
        if (!before || !after) continue;
        const gapB = sentence.slice(before.at + before.text.length, m.index);
        const gapA = sentence.slice(m.index + m[0].length, after.at);
        if (gapB.length > GAP_BEFORE || gapA.length > GAP_AFTER) continue;      // note (e)
        if (GAP_POISON.test(gapB) || GAP_POISON.test(gapA)) continue;           // note (e)
        const up = rel === 'above' || rel === 'higher than';
        const pairs = [];
        for (const a of before.keys) for (const b of after.keys) if (a !== b) pairs.push([a, b]);
        if (!pairs.length) continue;
        const bad = pairs.filter(([a, b]) => (up ? INDEX[a] > INDEX[b] : INDEX[a] < INDEX[b]) === false);
        claims++;
        lessonsCovered.add(slug);
        if (SURVEY) {
          survey.push(`${bad.length ? 'FAIL' : 'ok  '} ${slug} :: ${field} [order] ` +
            `${label(before.keys)} ${rel} ${label(after.keys)}`);
        }
        if (bad.length) {
          findings.push({
            slug, field, kind: 'order', voice: label(before.keys),
            said: `${label(before.keys)} ${rel} ${label(after.keys)}`,
            real: bad.map(([a, b]) => `${KEY_TO_DRUM[a]} is on ${nameIndex(INDEX[a])} and ` +
              `${KEY_TO_DRUM[b]} on ${nameIndex(INDEX[b])}`).join('; '),
            clause: sentence.trim(),
          });
        }
      }

      // "<A> ... between <B> and <C>" — every member of a collective A must fall
      // strictly inside. This is what catches "Toms sit between snare and hi-hat".
      const btw = /\bbetween\b/i.exec(sentence);
      if (!btw) continue;
      const subject = vs.filter(v => v.at + v.text.length <= btw.index).pop();
      const rest = vs.filter(v => v.at >= btw.index + btw[0].length);
      if (!subject || rest.length < 2) continue;
      if (sentence.slice(subject.at + subject.text.length, btw.index).length > GAP_BEFORE) continue;
      const joiner = sentence.slice(rest[0].at + rest[0].text.length, rest[1].at);
      if (!/^\s*(?:and|&)\s*$/i.test(joiner)) continue;
      const ends = [...rest[0].keys, ...rest[1].keys];
      if (subject.keys.some(k => ends.includes(k))) continue;
      const lo = Math.min(...rest[0].keys.map(k => INDEX[k]), ...rest[1].keys.map(k => INDEX[k]));
      const hi = Math.max(...rest[0].keys.map(k => INDEX[k]), ...rest[1].keys.map(k => INDEX[k]));
      const outside = subject.keys.filter(k => !(INDEX[k] > lo && INDEX[k] < hi));
      claims++;
      lessonsCovered.add(slug);
      if (SURVEY) {
        survey.push(`${outside.length ? 'FAIL' : 'ok  '} ${slug} :: ${field} [order] ` +
          `${label(subject.keys)} between ${label(rest[0].keys)} and ${label(rest[1].keys)}`);
      }
      if (outside.length) {
        findings.push({
          slug, field, kind: 'order', voice: label(subject.keys),
          said: `${label(subject.keys)} between ${label(rest[0].keys)} and ${label(rest[1].keys)}`,
          real: outside.map(k => `${KEY_TO_DRUM[k]} is on ${nameIndex(INDEX[k])}, outside ` +
            `${nameIndex(lo)}..${nameIndex(hi)}`).join('; '),
          clause: sentence.trim(),
        });
      }
    }
  }
}

// ---- RULE 3: the middle line carries no drum voice.
//
// Every key the CORPUS uses is measured here, not just the ones player.js maps.
// Skipping unmapped keys was a hole the mutation harness found: `b/4` IS the
// middle line and VexFlow draws it perfectly well, it simply has no player voice
// — so a b/4 notehead planted in an exercise sailed through the one rule written
// to notice it. A key that cannot be measured at all is left to
// check-player-keys, which fails on exactly that.
// indexOfCorpusKey() lives above, next to fieldsOf(), because rule 5 needs it
// too. It falls back to INDEX for keys player.js maps and probes the renderer
// for anything else, which is what keeps b/4 — a key with no player voice but a
// perfectly drawable notehead — visible to this rule.
const MIDDLE_LINE_INDEX = 4;
const onMiddleLine = new Map();
// Counted so the SCAN itself is asserted, not only its verdict. Nothing in the
// corpus is on the middle line, so this rule's output is an empty map whether it
// works or not, and the adversarial pass at iteration 77 removed it whole and
// watched every gate stay green. 14244 noteheads carry a key today; a floor of
// 13000 absorbs ordinary content churn and fails a scan that stopped scanning.
let middleLineKeysScanned = 0;
const MIDDLE_LINE_SCAN_FLOOR = 13000;
for (const [slug, lesson] of Object.entries(lessonContent)) {
  for (const ex of lesson.exercises || []) {
    for (const voice of ['hands', 'feet']) {
      for (const n of ex[voice] || []) {
        if (n.rest) continue;
        const parts = [n, ...(n.grace ? (Array.isArray(n.grace) ? n.grace : [n.grace]) : [])];
        for (const part of parts) {
          for (const key of part.keys || n.keys || []) {
            middleLineKeysScanned++;
            if (indexOfCorpusKey(key) !== MIDDLE_LINE_INDEX) continue;
            onMiddleLine.set(slug, (onMiddleLine.get(slug) || 0) + 1);
          }
        }
      }
    }
  }
}

if (SURVEY) {
  survey.forEach(r => console.log(r));
  const mid = [...onMiddleLine.values()].reduce((a, b) => a + b, 0);
  console.log(`\n[survey] ${claims} claims across ${lessonsCovered.size} lessons, ` +
    `${findings.length} contradictions; middle line carries ${mid} drum notes`);
  findings.forEach(f => console.log(`   -> ${f.slug} :: ${f.field}: ${f.said} | ${f.real}`));
  process.exit(0);
}

if (middleLineKeysScanned < MIDDLE_LINE_SCAN_FLOOR) {
  console.error('[check-staff-positions] FAIL — the middle-line scan examined ' +
    `${middleLineKeysScanned} noteheads, floor is ${MIDDLE_LINE_SCAN_FLOOR}.`);
  console.error('  Nothing in the corpus sits on the middle line, so this rule reports an empty result');
  console.error('  whether it ran or not. The count is the only witness that it ran at all.');
  process.exit(1);
}
if (indexOfCorpusKey('b/4') !== MIDDLE_LINE_INDEX) {
  die(`the middle-line rule believes b/4 renders on position ${indexOfCorpusKey('b/4')}, not ` +
    `${MIDDLE_LINE_INDEX}. b/4 IS the middle line — that is the whole premise of the rule, and of ` +
    'reading-101 teaching that the line stays empty.');
}

if (onMiddleLine.size) {
  console.error('[check-staff-positions] FAIL — a drum voice is written on the middle line:');
  for (const [slug, n] of onMiddleLine) console.error(`  ${slug}  ${n} note(s)`);
  console.error('  reading-101 teaches that the middle line stays empty. Either that sentence is now');
  console.error('  wrong, or this exercise is. Do not fix one without reading the other.');
  process.exit(1);
}

if (findings.length) {
  console.error(`[check-staff-positions] FAIL — ${findings.length} prose claim(s) contradict the rendered geometry:`);
  for (const f of findings) {
    console.error(`  ${f.slug} :: ${f.field}  [${f.kind}, ${f.voice}]`);
    console.error(`     prose  : ${f.said}`);
    console.error(`     renders: ${f.real}`);
    console.error(`     "${f.clause.slice(0, 170)}"`);
  }
  console.error('\n  The geometry is measured from the renderer on every run, so it is not the side to');
  console.error('  doubt. Check the prose against the drum key in the-drum-kit, which was verified');
  console.error('  against real geometry at iteration 58, before editing anything.');
  process.exit(1);
}

if (claims < COVERAGE_FLOOR) {
  console.error(`[check-staff-positions] FAIL — coverage floor breached: ${claims} claims parsed, floor is ${COVERAGE_FLOOR}.`);
  console.error('  Every claim agreed with the geometry, but the parser is reading less of the corpus');
  console.error('  than when the floor was set. A gate that quietly stops looking is worse than one');
  console.error('  that fails. Fix the parser, or lower the floor in the commit that explains why.');
  process.exit(1);
}

console.log(`[check-staff-positions] OK — ${claims} staff-position claims across ${lessonsCovered.size} lessons ` +
  `agree with the rendered geometry (floor ${COVERAGE_FLOOR}); middle line carries no drum voice.`);
console.log(`  calibration: ${calibration.join(', ')} | stave lines ${STAVE.join('/')} | step ${STEP}`);
process.exit(0);
