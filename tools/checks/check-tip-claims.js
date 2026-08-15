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
// ---------------------------------------------------------------------------
// GENERALISED at iteration 71 (BL-086 chunk 2).
//
// It used to understand exactly one sentence shape — a tip saying the SNARE is
// "on X and Y" — which reached 51 of 852 exercises, about 6%. It now parses the
// general claim
//
//     <voice> [is|sits|stays|lands|...] on <position list>
//
// for every voice the player can sound, with positions written as `N`,
// `& of N`, `e of N` or `a of N` (and the hyphenated `&-of-N` spellings the
// corpus actually uses). Voice keywords resolve to VexFlow keys through the
// same map player.js schedules audio from, and positions resolve on the
// exercise's OWN grid using the tick arithmetic below, so tuplets, 5/4 and
// 16th-grid exercises all work.
//
// WHAT IS ASSERTED, and what deliberately is not. The gate fails when a
// position the tip NAMES does not carry that voice. It does NOT fail when the
// voice also sounds somewhere the tip leaves unnamed. The old single-shape
// check tested set equality, which is safe for "the snare is on 2 and 4" and
// wrong for almost every other sentence in the corpus: "the kick on 3 supplies
// the attack", "Beats 1-2: standard metal groove (china + snare on 2)" and
// "Quarter china on 1, 2, 4" all name a subset of a longer line on purpose.
// Surveyed across the whole corpus, the unnamed-extra direction produced 20 of
// 29 alarms and every one of them was a partial mention, not a contradiction.
// The named-but-silent direction is also the one that catches this campaign's
// actual defect: every wrong-beat exercise BL-086 filed names a beat the stave
// does not play. So the gate keeps the direction that finds bugs and drops the
// one that manufactures noise.
//
// ---------------------------------------------------------------------------
// THE FIVE FALSE-POSITIVE CLASSES. Four were documented by the screening script
// this replaces (6 false alarms out of 13); the fifth was named by the
// iteration-70 gate audit as ~60% of the remainder. Each is handled explicitly
// below rather than hand-waved.
//
//   1. GHOST NOTES. Ghosts are also c/5, so a correct backbeat surrounded by
//      ghosts looked wrong to the old set-equality test: the ghosts read as
//      EXTRA notes. Since extras are now reported rather than failed, this class
//      no longer needs a filter in the failing path at all — a ghost can only
//      add a position, never silence a claimed one. The accented-only set is
//      still computed, and it is what the partial-mention count is measured
//      against. Filtering it out of the FAILING path was itself a bug: it
//      deleted the very stroke fusion-jazz-rock Ex 4 claims when it says "a
//      comping snare on the &-of-2", because that stroke is deliberately quiet.
//   2. TUPLETS. Naive cumulative durations put a shuffle backbeat at 2.5 and
//      5.5. Those bars carry an explicit `tuplets` declaration that scales each
//      note by notes_occupied / num_notes, which is exactly what
//      audit-lessons.js already does — reusing its arithmetic puts the backbeat
//      back on 2 and 4. An earlier attempt invented a note-count grid instead
//      and made this case worse, not better.
//   3. MULTI-BAR PHRASES. A tip that says "Bar 1 sits in regular rock time" is
//      describing one bar of several. Only the first bar is checked, a multi-bar
//      exercise is checked only when the tip scopes itself to bar 1, and — since
//      one tip routinely describes both bars in two clauses — any individual
//      SENTENCE that names a later bar is dropped even when the tip as a whole
//      mentions bar 1. rock-half-time#3's "bar 1 is regular rock (snare on 2 and
//      4), bar 2 is half-time (snare on 3 only)" needs both halves of that rule.
//      Nothing else about the claim's subject is guessed either. There is no
//      shared-key guard: naming a cross-stick or a ghost elsewhere in the tip
//      used to skip the exercise, and that only ever cost coverage.
//   4. UNNOTATED VOICES. independence-singing Ex 1 writes the SUNG pulse on the
//      snare line — the only place to put a vocalised quarter on a drum stave —
//      while its tip's "snare on 2 and 4" describes a played part it says
//      outright is "not notated above". Checking one against the other is a
//      category error. This exemption used to be the bare substring `sing `,
//      which matches inside phra-sing, clo-sing, pas-sing and relea-sing: 39
//      tips carry such a token and only 5 are the word. Every exemption is now
//      anchored on word boundaries AND scoped: a vocal-score marker compromises
//      the HANDS stave only, so the "kick on 1 and 3" in the same tip is still
//      checked, and everything else is judged one clause at a time.
//   5. CLAUSE TERMINATION (new). "Kick on 1, &-of-2, and wherever the bass
//      goes" parses as "kick on 1, &-of-2" and then reads as exhaustive, which
//      it is not. A parsed list is only trusted when the text right after it
//      ends the clause. If it continues with a conjunction — and / & / or /
//      plus / then / ", and" — the list is assumed incomplete and skipped.
//
// Plus NEGATED AND HYPOTHETICAL CLAUSES: "Beginners want to add a snare on 2;
// resist" is not a claim that there is a snare on 2. A negator is consulted only
// where it can actually govern — in the text from the start of the clause to the
// end of the position list, with parenthetical asides removed. Reading the whole
// clause instead muted "Snare on 2 and 4, no ghost notes" (a reassurance AFTER
// the claim) and "Quarter-note hat (not 8ths!), snare on 2 and 4" (an aside
// about a different voice), both of which the single-shape gate had enforced.
//
// Exit 0 = every checkable claim agrees with its notation.
// `--survey` prints every parsed claim and its verdict without failing, which
// is how the exemption lists below were derived.

const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const lessonContent = require(path.join(ROOT, 'src/_data/lessonContent.js'));

const SURVEY = process.argv.includes('--survey');

// The floor exists so coverage cannot silently erode: a refactor that quietly
// stops parsing half the corpus fails here instead of reporting a green 6%.
// Set at iteration 71, when the generalised parser read 311 DISTINCT claims
// across 227 exercises. Distinct is the word that matters: the first draft
// counted raw parser hits, so the four spellings of "hi-hat foot" scored one
// assertion four times and 250 reported claims were only 199 real ones — a
// floor set on that inflated number would have failed the very de-duplication
// that fixed it. The old single-shape check enforced 51 claims, all snare, and
// tools/checks parity is asserted separately: every one of those 51 is still
// enforced. A 16-claim gap absorbs content edits that legitimately reword a
// tip; a bigger drop is erosion and should be looked at, not waved through.
const COVERAGE_FLOOR = 295;

const BASE = { w: 4, h: 2, q: 1, 8: 0.5, 16: 0.25, 32: 0.125, 64: 0.0625 };

// Staff position -> voice, copied from src/assets/js/player.js KEY_TO_DRUM.
// check-player-keys.js already enforces that lessonContent uses no other key.
const KEY_TO_DRUM = {
  'g/5/x2': 'hat', 'c/5': 'snare', 'f/4': 'kick', 'd/4/x2': 'foot',
  'f/5/x2': 'ride', 'e/5/x2': 'bell', 'a/5/x2': 'crash', 'b/5/x2': 'china',
  'e/5': 'tomHigh', 'd/5': 'tomMid', 'a/4': 'tomFloor',
};

// Tip vocabulary -> key. Longest keyword first so "hi-hat foot" is not eaten by
// "hi-hat". Several spellings map to one key on purpose; the claim loop counts
// an assertion once regardless of how many of them reach it.
const VOICES = [
  ['hi-hat foot', 'd/4/x2'], ['hi-hat-foot', 'd/4/x2'], ['hat foot', 'd/4/x2'],
  ['hat-foot', 'd/4/x2'], ['hihat foot', 'd/4/x2'], ['foot hi-hat', 'd/4/x2'],
  ['foot-hat', 'd/4/x2'], ['foot hat', 'd/4/x2'],
  ['cross-stick', 'c/5'], ['cross stick', 'c/5'],
  ['floor tom', 'a/4'], ['floor-tom', 'a/4'],
  ['high tom', 'e/5'], ['hi tom', 'e/5'], ['hi-tom', 'e/5'], ['high-tom', 'e/5'],
  ['mid tom', 'd/5'], ['mid-tom', 'd/5'], ['middle tom', 'd/5'],
  ['bass drum', 'f/4'], ['kick drum', 'f/4'], ['kick', 'f/4'],
  ['hi-hat', 'g/5/x2'], ['hihat', 'g/5/x2'], ['hi hat', 'g/5/x2'], ['hat', 'g/5/x2'],
  ['snare', 'c/5'],
  ['ride', 'f/5/x2'],
  // "cowbell" only. A bare "bell" is not a key: "ride bell on 2 and 4" and
  // "Accent the bell on 1 and 3" mean an ARTICULATION of the ride (f/5/x2), not
  // the cowbell line (e/5/x2), and mapping the word to e/5/x2 reported four
  // exercises as claiming a voice they never notate.
  ['cowbell', 'e/5/x2'],
  ['crash', 'a/5/x2'],
  ['china', 'b/5/x2'],
];
const VOICE_WORDS = new Set(VOICES.map(([w]) => w));
// Keys carried by more than one named voice: if the tip names both, the stave
// cannot say which one the claim is about.
// There is deliberately no shared-key guard any more. It existed to stop ghost
// strokes — also c/5 — from looking like EXTRA notes beside a correct backbeat,
// and extras are reported rather than failed. Under the named-but-silent test a
// ghost can only ever ADD a position, never take away a claimed one, so the
// guard prevented no failure and cost real coverage: it was the sole reason
// ghost-notes-found Ex 4, funk-linear-funk Ex 4, funk-purdie-intro Ex 1 and
// rock-hybrid-grooves Ex 1 stopped being checked, all four of them claims the
// single-shape gate had enforced since iteration 52.

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

// Every note of one stave with its position in quarter-note units from the top
// of the bar, plus how many bars the stave runs to.
function voicePositions(ex, voiceName) {
  const barTicks = ex.expectedBeats || beatsExpected(ex.timeSignature);
  if (!barTicks) return null;
  const arr = ex[voiceName] || [];
  const out = [];
  let t = 0;
  for (let i = 0; i < arr.length; i++) {
    const n = arr[i];
    let tk = tickOf(n);
    if (tk === null) return null;
    const tup = tupletAt(ex.tuplets, voiceName, i);
    if (tup) tk *= tup.notes_occupied / tup.num_notes;
    out.push({ n, tick: t, tup: tup || null });
    t += tk;
  }
  return { notes: out, total: t, bars: Math.max(1, Math.round(t / barTicks)) };
}

// Where does "the & of 4" fall? On a plain beat, halfway. Inside a triplet beat
// it is the SECOND of three and "the a of 4" is the third, because a triplet is
// counted 1-&-a — independence-chapin-method Ex 5 says so in as many words
// ("the a of 4 — the last triplet partial of the bar") and sits at 4.667, which
// a fixed 16th grid reads as a contradiction. So subdivisions resolve against
// whatever grid the claimed beat is actually written in. Any tuplet that is not
// a plain 3:2 (quintuplets, 7:4) has no agreed subdivision names at all, and an
// `e` has no meaning inside a triplet, so both return null and the claim is
// skipped rather than guessed.
const OFFSET_NAME = new Map([[0.5, '&'], [0.25, 'e'], [0.75, 'a']]);
function offsetOnGrid(vp, beat, off, beatLen) {
  if (!off) return 0;
  if (!vp) return null;
  const tick0 = (beat - 1) * beatLen;
  const inBeat = vp.notes.filter(p => p.tick >= tick0 - 1e-6 && p.tick < tick0 + beatLen - 1e-6);
  const tup = inBeat.map(p => p.tup).find(Boolean);
  if (!tup) return off * beatLen;                                   // plain 16th grid
  const ratio = tup.notes_occupied / tup.num_notes;
  if (Math.abs(ratio - 2 / 3) > 1e-9) return null;                  // not a triplet
  const name = OFFSET_NAME.get(off);
  if (name === '&') return beatLen / 3;
  if (name === 'a') return (2 * beatLen) / 3;
  return null;                                                      // no "e" in a triplet
}

// ---------------------------------------------------------------------------
// Tip text
const plain = s => String(s || '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#39;|&rsquo;/g, "'")
  .replace(/&quot;/g, '"').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
  .replace(/\s+/g, ' ')
  .trim();

// Class 4, word-anchored. Each of these says outright that the stave is drawing
// something other than the played part the tip is describing — a sung line on
// the snare space, a crash in the bar after this one, a trigger the kit cannot
// make. It must NOT catch the verb used as a practice instruction: "sing any
// melody over it while you play" and "Sing 1-2-3-4 out loud" are things to do,
// not statements about the notation, and exempting their whole exercise threw
// away hiphop-future-r-and-b Ex 3's kick line and funk-displacement Ex 1's
// reference backbeat. So the markers are the structural ones the SUNG/PLAYED
// lessons actually use, not the bare verb.
// Split by SCOPE, because a blanket exercise-level skip is how this exemption
// quietly retired claims the gate used to enforce. A SUNG/PLAYED lesson writes
// its vocal line on the HANDS stave, so it compromises hands voices only — the
// "kick on 1 and 3" in the same tip is on the feet stave and is perfectly
// checkable. Everything else is a statement about one clause, not the exercise.
const STAVE_IS_A_VOCAL_SCORE = [
  /\bSUNG\b/,                                        // "SUNG part (upper):" — deliberately case-sensitive
  /\bsung (?:part|line|pulse|melody|figure)\b/i, /\bvocal score\b/i,
];
const CLAUSE_IS_UNNOTATED = [
  /\bnot notated\b/i, /\bnot shown\b/i, /\bnot on the (?:stave|staff|page)\b/i,
  /\bisn't notated\b/i, /\bun-?notated\b/i, /\bnot written\b/i,
  /\bdescribed, not\b/i,
  /\btrigger pad\b/i, /\bsample pad\b/i, /\bin performance\b/i,
];

// A sentence carrying any of these is an instruction, a warning, a
// counterfactual or a description of something ABSENT — not an assertion that
// the stave draws the thing at the named position. "the missing snare hit on 2"
// and "the next exercise removes the snare on 2" are the two shapes that
// motivated the absence group.
const NON_ASSERTION = [
  /\bnot\b/i, /\bn't\b/i, /\bnever\b/i, /\bno\b/i, /\bwithout\b/i,
  /\bavoid\b/i, /\bresist\b/i, /\binstead\b/i, /\brather than\b/i,
  /\btempt/i, /\bwant to\b/i, /\bimagine\b/i, /\bwould\b/i, /\bif you\b/i,
  /\btry\b/i, /\bcould\b/i, /\bmight\b/i, /\bshould\b/i,
  /\bnext (?:bar|exercise|lesson)\b/i, /\bused to\b/i, /\bpreviously\b/i,
  /\bmissing\b/i, /\bremoves?\b/i, /\bremoved\b/i, /\bomit/i, /\babsent\b/i,
  /\bsilent\b/i, /\bleaves\b/i, /\bdrops? out\b/i, /\bextra\b/i,
  /\bdrops? (?:the|a|that|it)\b/i,                    // "Drop the snare on beat 2 entirely"
  /\bsome (?:players|drummers|people)\b/i, /\btry it\b/i,   // an optional variation, not this bar
  /\bexpect/i,                                       // "Listeners' ears expect a snare on 2" — and don't get one
  /\b(?:then|next|later) add\b/i,                    // "...steady first, THEN ADD the hat foot on 2 and 4" — not yet on the stave
  /\bjournal\b/i,                                    // practice-systems Ex 2 is a blank journal page, not a groove
  /\bswap\b/i, /\bexercise \d/i, /\bversus\b/i, /\bvs\b/i,
];

// The claim is counted in a unit other than the notated beat, and the tip says
// so out loud. odd-meters-9-8 Ex 2: "the snare lands on beats 2 and 3 OF THE
// DOTTED-QUARTER PULSE (count 4 and count 7)" — it even gives the real counts,
// which match. metal-tech-death Ex 1: "FEEL THE METER AS 3+2 — the snare ...
// falls inside the 3". Read on the 8th grid both look like contradictions.
// NOT "feel the bar as 2 + 3": that is a phrasing hint, and the positions named
// after it are still ordinary beats. Guarding on it cost hiphop-future-r-and-b
// Ex 3 — one of this campaign's own fixes — all of its coverage.
const REGROUPED = [
  /\bof the [\w-]+ pulse\b/i, /\bcount(?:ed)? (?:in|as)\b/i, /\binside the \d\b/i,
];

// Position tokens. `N` alone, or the four sixteenth-grid names, in the spaced
// ("& of 3") and hyphenated ("&-of-3") spellings the corpus mixes freely.
const SUBDIV = { '&': 0.5, and: 0.5, e: 0.25, a: 0.75, ah: 0.75 };
// The lookahead rejects a number that is really part of a bigger token — 16ths,
// 4/4, ♩=120, 2.5 — without rejecting a position that simply ends the sentence.
// An earlier `(?![\d.:/])` swallowed the trailing full stop and silently dropped
// every claim whose last position was the last word, which the mutation harness
// caught and no amount of reading did.
// The ordinal guard must ATTACH to the digit — "16th" is not a position, but
// "the a-of-4 that hands off" is, and an earlier `\s*(?:th|...)` matched the
// "th" of "that" and silently killed every claim followed by a that/the/then.
// `(?:beats?\s+)?` is load-bearing, not cosmetic: 62 corpus tips write "on beat
// 4" rather than "on 4", and without it jazz-broken-time-intro — the one lesson
// this campaign resolved in favour of the prose — had ZERO gate coverage.
const POS_RE = /^(?:the\s+)?(?:(&|and|e|a|ah)\s*(?:-\s*)?of\s*(?:-\s*)?(?:beats?\s+)?(\d+)|(?:beats?\s+)?(\d+))(?!\d|\.\d|:\d|\/\d|(?:th|st|nd|rd)\b|\s*bpm\b|\s*bars?\b)/i;
// A separator that keeps a list going. `,` is provisional: a comma followed by a
// new subject ("ride on the & of 1, snare on the & of 2") is a clause boundary,
// not a continuation, so readList rolls back over it. `and` / `&` / `plus` /
// `then` are not provisional — if one of those is followed by something the
// parser cannot read, the list really is incomplete.
// An `&` is a separator ("2 & 4") AND the name of a position ("& of 2"), so a
// separator may only claim it when no "of" follows — otherwise ", &-of-2" was
// eaten as a separator and the list stopped one item in.
const SEP_RE = /^(?:\s*,\s*and\b(?![\s-]*of\b)|\s*,\s*&(?![\s-]*of\b)|\s*,|\s*\band\b(?![\s-]*of\b)|\s*&(?![\s-]*of\b)|\s*\bplus\b|\s*\bthen\b)/i;
const SEP_PROVISIONAL = /^\s*,\s*$/;
// The connector between a voice and its position list.
const LINK_RE = new RegExp(
  '^(?:\\s+(?:is|are|was|sits|sit|stays|stay|still|now|only|just|also|again|back|' +
  'lands|land|landing|falls|fall|hits|hit|plays|play|goes|go|comes|remains|' +
  'placed|voiced|doubles|double|drops|drop|marks|mark|keeps|keep|the|its|it|' +
  'a|an|adds|add|added|' +   // "Snare ADDS A hit on the &-of-3" — latin-mozambique Ex 2
  'line|lines|up|both|all|two|three|four)\\b)*\\s*(?:\\bon\\b|\\bat\\b)\\s+', 'i');

// Read a position list starting at `text[i]`. Returns null when nothing parses,
// otherwise { positions, end } where `end` is the index just past the list.
function readList(text, i) {
  const positions = [];
  let cur = i;
  for (;;) {
    let before = cur;
    let provisional = false;
    if (positions.length) {
      const sep = SEP_RE.exec(text.slice(cur));
      if (!sep) break;
      provisional = SEP_PROVISIONAL.test(sep[0]);
      cur += sep[0].length;
    }
    const rest = text.slice(cur).replace(/^\s+/, '');
    const skipped = text.slice(cur).length - rest.length;
    const m = POS_RE.exec(rest);
    if (!m) {
      if (!positions.length) return null;
      // A bare comma that is not followed by another position was a clause
      // boundary all along — rewind and call the list finished. `settled` says
      // the caller must not re-test termination, because `end` now points AT
      // the comma and the termination test would read it as a live separator.
      if (provisional) return { positions, end: before, dangling: false, settled: true };
      return { positions, end: cur, dangling: true };
    }
    positions.push(m[1] ? { beat: Number(m[2]), off: SUBDIV[m[1].toLowerCase()] } : { beat: Number(m[3]), off: 0 });
    cur += skipped + m[0].length;
  }
  return { positions, end: cur, dangling: false };
}

// Class 5: the list is only trusted when the clause ends here.
function terminatesCleanly(text, end) {
  const rest = text.slice(end);
  if (/^\s*$/.test(rest)) return true;
  if (SEP_RE.test(rest)) return false;                 // list is still going
  // An OPENING bracket ends the clause every bit as much as a closing one:
  // "Snare on 1 and 3 (right where the click is)" is a claim with a
  // parenthetical after it, and accepting ")" but not "(" quietly discarded
  // every such claim — a flat lie in that shape passed the gate.
  return /^\s*(?:[.,;:!?()[\]]|—|–|-)/.test(rest)     // punctuation ends the clause
    || /^\s+[A-Za-z]/.test(rest);                      // a new word, not a separator
}

// ---------------------------------------------------------------------------
// Real contradictions this generalised parser surfaces that BL-086's campaign
// has not reached. These are NOT checker limits and must not be filed as such:
// each is a live defect in the CONTENT, listed here only because the tick that
// found it could not establish which side is wrong. The list may only shrink,
// and an entry must say what evidence a decision is waiting on.
// Keyed by `slug#index|key` so it retires ONE voice's claim, never the whole
// exercise. The un-scoped version silently stopped checking funk-james-brown
// Ex 1's "Snare on 2 and 4" — a claim the gate had enforced since iteration 52 —
// as a side effect of parking its kick line.
const KNOWN_OPEN = {
  'funk-james-brown#0|f/4': 'BL-086. Tip says "Kick on 1, the & of 2, and the & of 3"; the stave has 1, 2.5, ' +
    '3.75 — the third kick is on the a of 3, not the & of 3. Both sides have real support and iteration 71 ' +
    'refused to guess. FOR THE TIP being wrong: sibling Ex 3 uses "the a of 1 and the a of 3" for exactly ' +
    '1.75 and 3.75, so the a-of-3 placement is native vocabulary here and the stave is idiomatic; and a ' +
    'prose fix is the reversible side. FOR THE SPEC being wrong: Ex 3 introduces the a-of-1 and a-of-3 as ' +
    'its new element ("the imagined horn stabs"), which only reads as new if Ex 1 does not already play ' +
    'a-of-3 — that argues Ex 1 should be 3.5 and the tip is right. Deciding needs the Cold Sweat ' +
    'transcription, which is not in the repo.',
};

// Claims this parser genuinely cannot read. Each is a limit of the CHECKER.
// Shrinking this list is the work; adding to it needs a stated reason. It held
// five entries under the single-shape check and the generalised parser reads
// four of them correctly, so they are gone: jazz-comping-vocab#3's bar-scoped
// melody now scopes itself, and the three meter-modulation tips are handled by
// the "N bars of X/Y" rule above rather than by name.
// hiphop-anderson-paak#2 was the fifth entry: its bar has ghost strokes but
// marks no accent:true, so the ghost filter cannot fire (BL-078 tracks that
// convention drift). It is not listed because the parser provably does not
// reach its tip today, and an exemption nothing exercises is an exemption
// nothing tests. If BL-078 lands and that tip becomes readable, expect this
// list to need it back.
const UNPARSEABLE = {};

const findings = [];
const surveyRows = [];
let checked = 0;
let partial = 0;
const covered = new Set();
// One assertion counted once. The claim loop tries every spelling in VOICES, so
// "hi-hat foot on 2 and 4" matches four synonyms that all resolve to d/4/x2 and
// used to be counted as four claims. 250 raw rows were 199 distinct.
const seenClaims = new Set();

for (const [slug, lesson] of Object.entries(lessonContent)) {
  (lesson.exercises || []).forEach((ex, i) => {
    const id = `${slug}#${i}`;
    if (UNPARSEABLE[id]) return;

    const tip = plain(ex.tip);
    if (!tip) return;
    // Class 4, exercise level and HANDS ONLY — see STAVE_IS_A_VOCAL_SCORE.
    const vocalStave = STAVE_IS_A_VOCAL_SCORE.some(re => re.test(tip));


    const hands = voicePositions(ex, 'hands');
    const feet = voicePositions(ex, 'feet');
    if (!hands && !feet) return;
    // A stave that sounds nothing is a template, not a groove — practice-systems
    // Ex 2 is an empty journal bar whose tip quotes example jottings.
    const sounds = [hands, feet].some(vp => vp && vp.notes.some(p => (p.n.keys || []).length));
    if (!sounds) return;
    const barTicks = ex.expectedBeats || beatsExpected(ex.timeSignature);
    if (!barTicks) return;
    const beats = Number(String(ex.timeSignature || '4/4').split('/')[0]) || 4;
    const beatLen = barTicks / beats;
    const bars = Math.max(hands ? hands.bars : 1, feet ? feet.bars : 1);

    // Class 3: bar scoping.
    const scopesBar1 = /\bbars?\s*(?:1|one)\b/i.test(tip);
    const scopesLater = /\bbars?\s*([2-9])\b/i.test(tip);
    if (scopesLater && !scopesBar1) return;
    if (bars > 1 && !scopesBar1) return;

    // Two different scopes, and conflating them was a bug the mutation harness
    // caught. BAR SCOPE belongs to the whole sentence: "Bar 2: ride on beat 1,
    // then ... a hit on the &-of-3" is entirely about bar 2, so splitting it at
    // the colon and judging the halves separately orphans the label and checks
    // bar 2's notes against bar 1's stave. NEGATION belongs to the clause:
    // "Snare on the & of 1 and the & of 4 — not on 2 and 4 at all" is a true
    // claim followed by a contrast, and muting the whole sentence throws the
    // claim away with it. So: split into sentences, split each sentence at a
    // comma that introduces a bar label (one sentence routinely describes two
    // bars), scope THAT, and only then split into clauses for the negation test.
    const sentences = tip.split(/(?<=[.;!?])\s+/)
      .flatMap(s => s.split(/,\s*(?=\bbars?\s*[1-9]\b)/i));
    for (const segment of sentences) {
      // Class 3, sentence level: this sentence is about a bar that is not bar 1.
      if (/\bbars?\s*[2-9]/i.test(segment) && !/\bbars?\s*(?:1|one)\b/i.test(segment)) continue;
      // A sentence that OPENS with a bar label is about that bar, whatever it
      // mentions later. jazz-comping-vocab Ex 3: "Bar 2 is the response: a strong
      // accented snare on beat 1 (the answer), then the same internal shape as
      // bar 1" — the trailing "as bar 1" is a comparison, not a change of scope.
      const opensOnBar = /^\s*bars?\s*([1-9])\b/i.exec(segment);
      if (opensOnBar && Number(opensOnBar[1]) !== 1) continue;
      if (REGROUPED.some(re => re.test(segment))) continue;
      // Class 3 again: a bar-map tip drops the word "bar" after the first item —
      // jazz-modern-jazz Ex 5 reads "Bars 1–2: Phrase A. 3–4: Phrase C — kick on
      // &-of-2." That "3–4:" is bar scope with no keyword to find it by.
      const barMap = /^\s*(\d+)\s*(?:[–—-]\s*\d+)?\s*:/.exec(segment);
      if (barMap && Number(barMap[1]) !== 1) continue;
      // Class 3 once more: a meter-modulation tip sets up bars in ANOTHER meter
      // that this stave does not draw — "play 2 bars of 4/4 (♩=160) with snare on
      // 2 and 4, then on the bar boundary switch to this 7/8 pattern". Those bars
      // are imagined, so their positions cannot be checked against this one.
      if (/\b\d+\s+bars?\s+of\s+\d+\s*\/\s*\d+/i.test(segment)) continue;
      for (const sentence of segment.split(/\s*[—–]\s*|\s*;\s*|\s*:\s+/)) {
      if (CLAUSE_IS_UNNOTATED.some(re => re.test(sentence))) continue;      // class 4, clause level
      for (const [word, key] of VOICES) {
        // Plurals count: "Kicks land on 1, & of 1, ..." is the same claim as
        // "Kick lands on ...", and requiring the singular dropped it entirely.
        const vre = new RegExp('\\b' + word.replace(/[-\s]/g, '[-\\s]') + '(?:e?s)?\\b', 'gi');
        let vm;
        while ((vm = vre.exec(sentence))) {
          if (KNOWN_OPEN[`${id}|${key}`]) continue;
          // A short keyword must not claim the tail of a longer voice name:
          // "hat" is not the voice in "foot-hat", which resolved a hi-hat-FOOT
          // claim against the hand hi-hat line. Only block when the hyphenated
          // token really IS another entry, though — "china-and-snare" is two
          // voices joined by a word, and a blanket lookbehind silently killed it.
          const before = sentence.slice(0, vm.index);
          const prev = /([\w]+)-$/.exec(before);
          if (prev && VOICE_WORDS.has(`${prev[1].toLowerCase()}-${word}`)) continue;
          const after = sentence.slice(vm.index + vm[0].length);
          const link = LINK_RE.exec(after);
          if (!link) continue;
          const list = readList(after, link[0].length);
          if (!list || !list.positions.length) continue;
          if (list.dangling || (!list.settled && !terminatesCleanly(after, list.end))) continue;  // class 5
          // A negator only governs a claim if it comes BEFORE the claim ends.
          // "Snare on 2 and 4, no ghost notes" is an assertion followed by a
          // reassurance, and reading the whole clause muted it; "the missing
          // snare hit on 2" and "Beginners want to add a snare on 2" put their
          // negator ahead of the claim, which is exactly what this still catches.
          // Parenthetical asides are stripped first: in "Quarter-note hat (not
          // 8ths!), snare on 2 and 4" the negator is inside an aside about a
          // different voice, and letting it govern the snare claim killed one of
          // the fifty-one the old gate enforced.
          const governing = sentence.slice(0, vm.index + vm[0].length + list.end)
            .replace(/\([^)]*\)/g, ' ');
          if (NON_ASSERTION.some(re => re.test(governing))) continue;
          // A trailing modifier can move the whole list into another bar:
          // "the kick on beat 1 OF THE NEXT BAR". The negation guard reads only
          // as far as the list ends, so this one has to be read just past it.
          if (/^\s*of (?:the (?:next|following|previous|last)|bar)\b/i.test(after.slice(list.end))) continue;
          if (list.positions.some(p => p.beat < 1 || p.beat > beats)) continue;

          // Where the voice actually sounds in bar 1, and where the claim puts
          // it — both resolved per stave, because a subdivision name only means
          // something against the grid that stave is written in.
          const actual = [];
          const accentedOnly = [];
          const wanted = new Set();
          let unresolvable = false;

          // Which staves are usable for this claim, and which actually carry the
          // voice. Class 4 at voice level: in a SUNG/PLAYED lesson the vocal line
          // is written on the HANDS stave, so a hands voice cannot be checked
          // there, but a feet voice in the same tip still can.
          const usable = [hands, feet].filter(vp => vp && !(vocalStave && vp === hands));
          if (!usable.length) continue;
          const carriers = usable.filter(vp =>
            vp.notes.some(p => p.tick < barTicks - 1e-6 && (p.n.keys || []).includes(key)));
          // Class 4 completed: if the voice is drawn ONLY on the stave the vocal
          // marker just disqualified, there is nothing left to check it against.
          // independence-singing Ex 1's "snare on 2 and 4" is the played part; the
          // snare space on its stave holds the sung quarters. Skip, do not fail.
          if (!carriers.length && vocalStave && hands &&
              hands.notes.some(p => p.tick < barTicks - 1e-6 && (p.n.keys || []).includes(key))) continue;
          // A voice the stave never draws is NOT a free pass. It used to be: the
          // claim resolved against no stave, produced an empty position set, and
          // sailed through — so deleting a voice outright made its own tip
          // unverifiable instead of wrong. The genuine "described but not
          // notated" cases are all caught upstream by CLAUSE_IS_UNNOTATED,
          // NON_ASSERTION and bar scoping, so an undrawn voice now resolves
          // against the first usable grid and fails as it should.
          for (const vp of (carriers.length ? carriers : [usable[0]])) {
            const bar1 = vp.notes.filter(p => p.tick < barTicks - 1e-6);
            // Class 1 belongs to the direction this gate no longer fails on, and
            // leaving it in the failing path was a bug. The ghost filter exists so
            // a correct backbeat surrounded by ghosts does not look like it has
            // EXTRA notes — but extras are reported, not failed. Subtracting the
            // unaccented strokes from the set a claim is tested against can only
            // invent MISSING ones, and it did: fusion-jazz-rock Ex 4 says "a
            // comping snare on the &-of-2" about a stroke that is deliberately
            // unaccented, and the filter deleted the very note being claimed.
            // So: test claims against every stroke; keep the accented-only set
            // for the partial-mention count.
            const anyAccent = key === 'c/5' && bar1.some(p => p.n.accent === true);
            for (const p of bar1) {
              if (!(p.n.keys || []).includes(key)) continue;
              const at = +(1 + p.tick / beatLen).toFixed(3);
              actual.push(at);
              if (!anyAccent || p.n.accent === true) accentedOnly.push(at);
            }
            for (const pos of list.positions) {
              const delta = offsetOnGrid(vp, pos.beat, pos.off, beatLen);
              if (delta === null) { unresolvable = true; break; }
              wanted.add(+(1 + (pos.beat - 1) + delta / beatLen).toFixed(3));
            }
          }
          if (unresolvable) continue;
          const act = [...new Set(actual)].sort((a, b) => a - b);
          const claimed = [...wanted].sort((a, b) => a - b);

          // One assertion, counted once, however many synonyms reached it.
          const sig = `${id}|${key}|${claimed.join(',')}|${sentence}`;
          if (seenClaims.has(sig)) continue;
          seenClaims.add(sig);

          checked++;
          const missing = claimed.filter(c => !act.includes(c));
          const extra = [...new Set(accentedOnly)].sort((a, b) => a - b)
            .filter(a => !claimed.includes(a));
          if (extra.length) partial++;
          // The unnamed-extra direction is off by default because almost every
          // tip names a subset on purpose — EXCEPT when it says so. "Ride on the
          // & of 2 and the & of 4 ONLY", "Snare on 3 only": `only` immediately
          // after the list is the author stating the list is exhaustive, and it
          // is the one signal that licenses the stronger test. Without it, a
          // regression that ADDS notes back without moving the claimed ones —
          // exactly how jazz-broken-time-intro Ex 3 became a duplicate of Ex 2 —
          // is invisible to a named-but-silent check.
          const exhaustive = /^\s*only\b/i.test(after.slice(list.end));
          const ok = !missing.length && !(exhaustive && extra.length);
          covered.add(id);
          if (SURVEY) surveyRows.push(`${ok ? 'ok  ' : 'FAIL'} ${id} [${KEY_TO_DRUM[key]}] claims ${claimed.join(',')} | stave ${act.join(',') || '(none)'} | "${sentence.slice(0, 110)}"`);
          if (!ok) findings.push({ id, title: ex.title, voice: KEY_TO_DRUM[key], claimed, act, missing, extra, sentence });
        }
      }
      }
    }
  });
}

const totalExercises = Object.values(lessonContent)
  .reduce((n, l) => n + (l.exercises || []).length, 0);

if (SURVEY) {
  surveyRows.forEach(r => console.log(r));
  console.log(`\n[survey] ${checked} claims parsed across ${covered.size} of ${totalExercises} exercises` +
    `, ${partial} name a subset of a longer line, ${findings.length} contradictions`);
  process.exit(0);
}

if (findings.length) {
  console.error(`[check-tip-claims] FAIL — ${findings.length} tip claim(s) contradict their own notation:`);
  for (const f of findings) {
    console.error(`  ${f.id}  ${f.title}`);
    console.error(`     tip says : ${f.voice} on ${f.claimed.join(', ')}`);
    console.error(`     notation : ${f.voice} on ${f.act.join(', ') || '(nowhere in bar 1)'}`);
    if (f.missing.length) console.error(`     claimed but silent : ${f.missing.join(', ')}`);
    if (f.extra.length) console.error(`     sounds but unclaimed: ${f.extra.join(', ')}`);
    console.error(`     "${f.sentence}"`);
  }
  console.error(`\n  Decide WHICH SIDE IS WRONG before editing. If every sibling exercise, the`);
  console.error(`  lesson body and the exercise title agree with the tip, the SPEC is the bug and`);
  console.error(`  editing the tip would launder it into the teaching. Changing a spec changes`);
  console.error(`  what the site plays, so it needs more evidence than a prose fix, not less.`);
  process.exit(1);
}

if (checked < COVERAGE_FLOOR) {
  console.error(`[check-tip-claims] FAIL — coverage floor breached: ${checked} claims parsed, floor is ${COVERAGE_FLOOR}.`);
  console.error(`  Every claim agreed with its notation, but the parser is reading far less of the`);
  console.error(`  corpus than it did when the floor was set. A gate that quietly stops looking is`);
  console.error(`  worse than one that fails, so this is a failure. Fix the parser, or lower the`);
  console.error(`  floor deliberately in the same commit that explains why.`);
  process.exit(1);
}

console.log(`[check-tip-claims] OK — ${checked} "<voice> on <positions>" claims across ${covered.size} of ` +
  `${totalExercises} exercises agree with their notation (floor ${COVERAGE_FLOOR}; ${partial} name a subset ` +
  `of a longer line, ${Object.keys(UNPARSEABLE).length} unparseable, ${Object.keys(KNOWN_OPEN).length} filed-open)`);
process.exit(0);
