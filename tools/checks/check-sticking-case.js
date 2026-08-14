#!/usr/bin/env node
// check-sticking-case.js — BL-078's decision, enforced.
//
// THE DECISION: a sticking letter names the HAND that plays the note, and
// nothing else. `R` is the right hand at any volume. Case is not a dynamic; a
// ghost is marked by `ghost: true` and an accent by `accent: true`.
//
// This exists because the convention drifted once already, quietly, over four
// lessons, and by iteration 65 the drift had reached the speakers: BL-097 read
// the sticking CASE to choose between the ghost tier (0.25) and the tap tier
// (0.5), so a miscased letter was a mis-played note. The prose drifted with it —
// finger-control#2 said "Hi-hat 16ths in the right hand, snare 16ths in the
// left. The r snare hits are all fingers" over notes lettered `r`, which is a
// physically impossible instruction inside one sentence. Nothing caught any of
// it, for thirteen iterations, because nothing was looking.
//
// SCOPE, because the pass line is easy to over-read: this gate checks that what
// the corpus DOES say is well-formed. It cannot check that the corpus says
// enough. Delete every `ghost: true` in lessonContent.js and this file prints
// "0 ghost markings all well-formed" and exits 0 — the count is a tally, not a
// floor, and there is no way to derive from the data alone which unmarked note
// its author meant as a ghost. Completeness is pinned elsewhere and only in
// part: tools/checks/check-accent-dynamics.js renders four of the marked
// exercises and would fail if their markers vanished. The other nine are held
// by nothing but review. Marking the ~119 inferred exercises is the follow-up
// that would let a real floor exist here.
//
// Five assertions, each a rule docs/content-style-guide.md states:
//
//   1. Every primary sticking is uppercase — only 'R' and 'L' exist.
//   2. Every GRACE sticking is lowercase. This is the one place case still
//      carries meaning and it is the standard rudimental spelling (flam = lR,
//      drag = llR); six lesson bodies teach it to the reader by name, so it is
//      a rule to hold, not an exception to tolerate.
//   3. No note is both accented and ghosted. They select different gains and
//      the player has to pick one, so the data must not ask.
//   4. `ghost: true` only where a ghost can physically be — a snare or tom key.
//      On a hat-only note it would be silently ignored by player.js
//      (GHOST_VOICES gates it), which is exactly the kind of dead marking that
//      later reads as a bug in the player.
//   5. `ghost` is never `false`. Absent means "not a ghost"; writing the word
//      next to `accent: true` reads as a contradiction to a human editor and
//      ships bytes that mean nothing.
//
// Exit 0 = the corpus agrees with the style guide.

const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const lessonContent = require(path.join(ROOT, 'src/_data/lessonContent.js'));

// Mirrors KEY_TO_DRUM / GHOST_VOICES in src/assets/js/player.js. Kept as a
// literal rather than parsed out of the player: this file is asserting what the
// content may say, and reading the answer from the code under test would make
// assertion 4 unfalsifiable.
const GHOSTABLE_KEYS = new Set(['c/5', 'e/5', 'd/5', 'a/4']);   // snare, tomHigh, tomMid, tomFloor

const fails = [];
let primary = 0, graces = 0, ghosts = 0;

for (const [slug, lesson] of Object.entries(lessonContent)) {
  (lesson.exercises || []).forEach((ex, i) => {
    for (const voice of ['hands', 'feet']) {
      (ex[voice] || []).forEach((note, j) => {
        const at = `${slug}#${i} ${voice}[${j}]`;

        if (typeof note.sticking === 'string' && /[A-Za-z]/.test(note.sticking)) {
          primary++;
          if (!/^[RL]+$/.test(note.sticking)) {
            fails.push(`${at} — sticking ${JSON.stringify(note.sticking)}: a primary sticking is ` +
                       `uppercase R or L and names the hand. Lowercase used to mean "ghost" here; ` +
                       `it does not any more — set ghost: true instead.`);
          }
        }

        const graceList = note.grace ? (Array.isArray(note.grace) ? note.grace : [note.grace]) : [];
        for (const g of graceList) {
          if (!g || typeof g.sticking !== 'string' || !/[A-Za-z]/.test(g.sticking)) continue;
          graces++;
          if (!/^[rl]+$/.test(g.sticking)) {
            fails.push(`${at} — grace sticking ${JSON.stringify(g.sticking)}: a flam or drag grace ` +
                       `is lowercase (lR, llR), which is the standard rudimental spelling the ` +
                       `lesson bodies teach.`);
          }
        }

        if ('ghost' in note) {
          if (note.ghost !== true) {
            fails.push(`${at} — ghost: ${JSON.stringify(note.ghost)}. Omit the key entirely when a ` +
                       `note is not a ghost.`);
            return;
          }
          ghosts++;
          if (note.accent === true) {
            fails.push(`${at} — carries both accent: true and ghost: true. Pick one; they are ` +
                       `opposite ends of the same dynamic.`);
          }
          if (note.rest) {
            fails.push(`${at} — a rest cannot be a ghost.`);
          }
          const keys = note.keys || [];
          if (!keys.some(k => GHOSTABLE_KEYS.has(k))) {
            fails.push(`${at} — ghost: true on keys ${JSON.stringify(keys)}. Only a snare or tom ` +
                       `stroke can be ghosted; player.js silently ignores the marker on anything ` +
                       `else, so this one does nothing.`);
          }
        }
      });
    }
  });
}

if (fails.length) {
  console.error(`[check-sticking-case] FAIL — ${fails.length} violation(s):`);
  fails.forEach(f => console.error('  ' + f));
  console.error('\n  The rule is in docs/content-style-guide.md under "Notation: what a sticking');
  console.error('  letter means". A letter names the hand at any volume; a ghost says ghost: true.');
  process.exit(1);
}

console.log(`[check-sticking-case] OK — ${primary} primary stickings all uppercase, ` +
            `${graces} grace stickings all lowercase, ${ghosts} ghost markings all well-formed`);
process.exit(0);
