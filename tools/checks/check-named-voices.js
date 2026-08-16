#!/usr/bin/env node
// check-named-voices.js — an instrument an exercise's own words name must be
// somewhere in that exercise's stave.
//
// BL-123, built from BL-099. Nine exercises across two lessons said "ride" in
// their titles and tips and drew a hi-hat — including a lesson titled "Quarters
// on the Ride" and a jazz independence lesson whose stated premise is "lock the
// ride and hi-hat foot into their jazz roles", which notated the hi-hat FOOT
// separately in the same bars. It survived 76 iterations. It was mutation-proved
// at iteration 76 that reverting all nine leaves every source-side gate green,
// and that writing the chapin SNARE on the hi-hat line does the same, so the
// blind spot is not ride-versus-hat: it is the whole class of A NOTE ON A WRONG
// BUT LEGAL STAFF POSITION. check-staff-positions reads sentences that name a
// line or a space; check-tip-claims reads beat positions; check-notation-frame
// reads geometry. None of them cross-references the INSTRUMENT the words name
// against the keys the stave contains. This file does.
//
// ---------------------------------------------------------------------------
// THE VOICE MAP IS READ, NOT RESTATED
//
// KEY_TO_DRUM is parsed out of src/assets/js/player.js and asserted against the
// table below, which was established and verified twice (iterations 74 and 76).
// The staff position of every key is MEASURED through the real notation renderer
// on every run, so the table is checked rather than transcribed:
//
//   key       voice        y    position
//   b/5/x2    china        43   above the 1st ledger above
//   a/5/x2    crash        48   1st ledger above
//   g/5/x2    hi-hat       53   space above the top line
//   f/5/x2    ride         58   top line
//   e/5/x2    bell         63   4th space
//   e/5       high tom     63   4th space  <- same position as the bell
//   d/5       mid tom      68   4th line
//   c/5       snare        73   3rd space
//   (b/4)     nothing      78   middle line — no drum, rests only
//   a/4       floor tom    83   2nd space
//   f/4       kick         93   1st space
//   d/4/x2    hi-hat foot 103   space below the stave
//
// The bell and the high tom SHARE a staff position and are told apart only by
// notehead shape, which is why this file matches on KEY IDENTITY and never on
// geometry. A position-based check could not see e/5/x2 swapped for e/5 at all.
//
// ---------------------------------------------------------------------------
// WHAT IS ASSERTED
//
//   1. EXERCISE WORDS. Every instrument named in an exercise's own title, meta
//      or tip must be notated in that exercise, unless the mention is exempt by
//      one of the rules below.
//   2. LESSON WORDS. Every instrument named in a lesson's graduationCriteria
//      must be notated SOMEWHERE in that lesson. Lesson-scoped on purpose:
//      graduation criteria describe the lesson, not one exercise, and asserting
//      them per exercise would demand a full kit in every warm-up.
//   3. LIMB. The two foot voices — kick (f/4) and hi-hat foot (d/4/x2) — must
//      live in the `feet` array. The renderer stems by VOICE, not by key, so a
//      kick written into `hands` draws stem-up and reads on the page as a hand.
//      Hand voices in `feet` are NOT asserted: four exercises do that
//      deliberately and say so in their tips ("the floor-tom 808 ... sitting in
//      the feet voice", "notated on the floor-tom line, but played with your
//      feet"), so the rule would fail true sentences.
//   4. COVERAGE FLOOR, so a refactor cannot quietly stop reading the corpus and
//      report a green zero.
//
// ---------------------------------------------------------------------------
// THE RULES THAT EXEMPT A MENTION — stated so a reader can check them
//
// A mention is a CLAIM ON THE STAVE only when it is an unhedged instruction to
// play that instrument in this exercise. Every rule below is a way English hedges
// it.
//
// HOW FAR EACH HEDGE REACHES. An earlier draft of this paragraph said the rules
// were clause-scoped with two exceptions; that was wrong, and it was wrong in
// the direction that flatters the file, so here is the real table. A tip is split
// into sentences, and each sentence into CLAUSES on , ; : and spaced dashes.
//
//   CLAUSE-SCOPED, 4 rules — a hedge cannot leave its own clause, which is what
//     stops "No snare yet" excusing the "ride 8ths" three words earlier:
//       ABSENT       marker anchored immediately before or after the mention
//       VERB         reads only the words touching the mention
//       COMPARED     anywhere in the clause
//       SUBSTITUTED  anywhere in the clause
//   SENTENCE-SCOPED WITH A PROXIMITY LIMIT, 2 rules:
//       DISPLACED    marker within MARK_WINDOW (45 chars) of the mention
//       ALTERNATIVE  sibling voice within a 30-char joiner beginning "or"
//   SENTENCE-SCOPED WITH NO PROXIMITY LIMIT, 4 rules — one marker anywhere in
//     the sentence exempts EVERY instrument named in it:
//       KNOWLEDGE, OPTIONAL, EXAMPLE, RECORDED
//   TWO SENTENCES, WITH A PROXIMITY LIMIT, 1 rule:
//       OTHER-BAR    bar numbers may carry over from the previous sentence,
//                    because the corpus writes "Bars 9-12: LOUD." and then the
//                    instruction on the next line
//
// The four unlimited rules are the exploitable ones, and the exploit is not
// academic. Both of these come out fully exempt today:
//
//   "Notate this bar from memory, then play the crash on beat 1 and the china
//    on beat 3."                                    -> KNOWLEDGE, both voices
//   "If you can, add a shaker later, and put a crash on beat 1 with a china on
//    beat 3."                                       -> OPTIONAL, both voices
//
// KNOWLEDGE is also a DISCLAIMER, so in the first case the exemption spreads to
// every other mention of the crash and the china in that exercise. Nothing in
// the corpus is written that way; a new tip could be, and this file would not
// say a word. Narrowing them needs a notion of which voice a hedge is ABOUT,
// which the clause-scoped four get for free and these four do not.
//
//   VERB. "ride" is the only word in this vocabulary whose verb sense occurs in
//     the corpus — `kicks`, `snares`, `hats` and `chinas` were each read and are
//     plural nouns every time ("eight kicks per bar", "sixteen hats"). A `ride`
//     token is the VERB when it is (i) the inflected form rides/riding/rode and
//     is not preceded by a determiner or a hyphenated modifier, so "quarter-note
//     rides" stays a noun and "the right hand rides the hat" does not; or (ii)
//     immediately followed by a determiner opening an object — ride the/this/
//     that/these/those/a/an/it/them/your/its/each/every/all — which is the shape
//     of "ride the offbeats" and "surf records ride this pattern". Prepositions
//     are deliberately NOT in that list: "ride on the & of 2" and "the ride on
//     beats 2 and 4" are both the noun.
//   ABSENT. A negator or an absence verb stands before the mention in its clause,
//     or an absence predicate follows it: no / not / never / without / drop /
//     omit / absent / silent / doing nothing / stops / off the. "No snare yet",
//     "the kick is completely absent", "the hat-foot is omitted".
//   DISPLACED. An explicit phrase puts the mention elsewhere: "the next bar",
//     "not shown", "not notated", "in exercise 2", "before the snare enters",
//     "you're about to".
//   OTHER-BAR. Arithmetic rather than a phrase. Bar references are resolved
//     against the exercise's OWN bar count, computed from its note durations:
//     "bar 5" in a one-bar exercise is elsewhere, "bar 4" in a four-bar exercise
//     is not, and "sixteen bars" in a one-bar exercise is a longer form than
//     this stave draws. Kept separate from DISPLACED because it is NOT a
//     disclaimer — see DISCLAIMED below.
//   COMPARED. A comparison or simile: like / -like / equivalent / than / as X as
//     / "this is how a" / "the way a" / "sounds like" / "version of".
//   SUBSTITUTED. The clause moves the part off or onto another instrument:
//     instead of / rather than / replace / swap / switch / "moves from X to Y" /
//     "is now on" / "takes over" / "in place of" / "X as Y voice".
//   ALTERNATIVE. The mention is one item in an either/or list where at least one
//     alternative IS notated — "the bell of the ride or a mounted cowbell — pick
//     whichever you have". Satisfied-by-a-sibling, so it cannot excuse a list
//     none of whose members is on the stave.
//   OPTIONAL. Explicitly conditional: "if you can", "can be added back", "only
//     if the song asks", "once it loops, move the L hand around the toms".
//   RECORDED. The sentence is about a record or a sample rather than the kit:
//     "half the surf records of the 1960s ride this pattern", "Imagined sample:
//     a busy loop — 16th hats".
//   KNOWLEDGE. The sentence is about identifying, naming or WRITING the
//     instrument rather than playing it: "Can identify snare, kick, and hi-hat
//     positions on the drum staff", "Notate bars 1-3 ... from memory".
//   EXAMPLE. An illustrative list — "at least three distinct timbres (cymbal
//     wash, snare buzz, tom roll)" names examples of a category, not a stave.
//   DISCLAIMED (a consequence of the others, applied per exercise and per voice).
//     If ANY mention of voice V in this exercise is exempt as ABSENT, DISPLACED,
//     SUBSTITUTED, ALTERNATIVE, OPTIONAL **or KNOWLEDGE**, every other mention of
//     V here is exempt too. The exercise has already told the reader that V is
//     not on this stave, so its remaining mentions cannot be read as demanding
//     it. This is what lets "Snare-Snare-Snare-CRASH" keep its title once the tip
//     says the crash "lives on beat 1 of the next bar (not shown)", and what lets
//     transcription-method#1's meta name a crash the reader is asked to WRITE.
//     KNOWLEDGE's membership is load-bearing: remove it and the corpus fails on
//     that exercise. NOT disclaimers: VERB, COMPARED, RECORDED and EXAMPLE, none
//     of which says anything about what the stave contains; and OTHER-BAR, for
//     the reason given at DISCLAIMERS itself. It is the widest rule in the file —
//     see the honest list below.
//
// The eleven false positives named in BL-123 all come out clean by rule — twelve
// rows, because the-shuffle#3 carries two different voices. Which rule cleared
// each one is recorded in KNOWN_CLEAN below, and that is ASSERTED rather than
// commented: if any of them ever starts failing, or starts passing for a
// different reason than the one recorded, this gate fails. KNOWN_CLAIMED beside
// it asserts the opposite half — the sentences that must still be READ as claims.
//
// ---------------------------------------------------------------------------
// HOW BROAD THE RULES ACTUALLY ARE
//
// `--defects` prints it, because the interesting number is not how often a rule
// fires but how often it is LOAD-BEARING: an exercise/voice pair where the voice
// is absent from the stave and this rule is a reason the file stays quiet. A
// rule that matches 500 sentences about voices that are present is not wide. At
// iteration 77, over 3398 mentions and 2043 pairs:
//
//   ABSENT 21 · DISPLACED 16 · COMPARED 8 · OTHER-BAR 7 · SUBSTITUTED 7 ·
//   VERB 6 · OPTIONAL 5 · KNOWLEDGE 4 · ALTERNATIVE 4 · EXAMPLE 1 · RECORDED 1
//
// Those are 80 (rule, pair) TUPLES over 74 DISTINCT pairs — six pairs are hedged
// twice, e.g. metal-d-beat#1[hat] under both ABSENT ("on china instead of hat")
// and COMPARED ("harder to articulate than the hat"). `--defects` prints both
// numbers so this paragraph can be re-derived instead of remembered; an earlier
// draft of it was transcribed by hand from a stale run and had DISPLACED and
// COMPARED off by one each, which the totals hid. All 74 pairs were read by hand
// when the file was written. If the tuple list grows without an iteration note
// explaining it, a rule has widened.
//
// ---------------------------------------------------------------------------
// MUTATION AUDIT, iteration 77: 44 cases, 44 as expected, 0 silent passes.
// 31 constructed defects, all caught. 13 expected-green: the baseline, 3 controls
// that inject nothing, 6 documented holes (notes a×2, c, j, k below, plus
// loosening the exemption ratchet itself, which is the same class as deleting
// any assertion line), and 3 loosenings that are genuine no-ops on this corpus —
// dropping hasKey's limb clause while rule 3 stands, zeroing the coverage
// floors, and not following grace notes.
//
// The adversarial pass then ran ~90 more against both gates and 26 synthetic
// sentences through the real classifier. It found no false pass on the corpus,
// and four defects now fixed: the VERB rule's second limb never looked left
// ("Give the ride a rest for one bar" read as the verb), and rule 3,
// ALTERNATIVE's sibling requirement and that same VERB guard were each deletable
// in silence. All four are covered by selfTest() above, and rule 3 additionally
// by the limbScanned floor.
//
// Four holes were found by the first harness and closed rather than written up:
//   * `as` as a substitution marker exempted "read it as the ride" — the BL-099
//     defect stated in writing. Removed.
//   * a bare "if the ..." counted as OPTIONAL and exempted three-limb-patterns#0.
//     Narrowed to a condition plus an addition verb.
//   * DISPLACED markers reached back a whole sentence, so chapin#4's "next
//     downbeat" excused the ride 21 characters later and hid a fully reverted
//     BL-099 exercise. Scoped to the sentence and to 45 characters.
//   * the ALTERNATIVE joiner mixed clause-relative and sentence-relative
//     offsets, so every or-list in a multi-clause sentence was mis-measured.
//
// ---------------------------------------------------------------------------
// WHAT STAYS GREEN THAT SHOULD NOT — read this before trusting a pass.
//
//   a. THE DISCLAIMED RULE IS THE WIDEST THING HERE, AND IT IS WIDER THAN THE
//      FIRST DRAFT OF THIS NOTE ADMITTED. One hedged mention of a voice frees
//      every other mention of that voice in the same exercise. It is per
//      exercise AND per voice, so it can never free a whole exercise, and
//      OTHER-BAR is kept out of it because bar numbering is sometimes the song's
//      rather than the stave's — but the reach is not five pairs, it is 132.
//      `--defects` prints the split: 5 are absent voices it is actively
//      excusing, and 127 are pairs whose voice IS notated today, which means
//      those 127 are pairs where breaking the notation would go unnoticed.
//
//      IT IS ALREADY LIVE ON A REAL PAGE, with no help needed.
//      jazz-medium-swing#0 "Ride Pattern Alone" is a stave of nothing but
//      f/5/x2, and its tip says "Faster tempo than your EARLIER ride-pattern
//      work". That one word is a DISPLACED marker, so "Ride Pattern Alone" and
//      "Just the ride." are both already freed. Move every notehead of that
//      exercise to the hi-hat line today and this gate stays green — the
//      mutation harness does exactly that and it passes. Nothing has to be
//      appended; the sentence is already there. That is the single worst thing
//      about this file, and the fix is a notion of which voice a hedge is
//      ABOUT, which is a rewrite rather than a tightening.
//   m. SIX OF THE ELEVEN RULES ARE SENTENCE-SCOPED AND FOUR OF THOSE HAVE NO
//      PROXIMITY LIMIT. See the scoping table at the top: one KNOWLEDGE,
//      OPTIONAL, EXAMPLE or RECORDED marker anywhere in a sentence exempts
//      EVERY instrument named in it, and KNOWLEDGE then spreads through
//      DISCLAIMED to the rest of the exercise. Two worked exploits are printed
//      there. This is the largest structural weakness in the file.
//   n. THREE RULES ARE DELETABLE IN SILENCE, and are defended only by selfTest()
//      above: rule 3 (its single corpus instance is exempted, and the exemption
//      marks itself used before any finding is pushed), ALTERNATIVE's
//      satisfied-by-a-sibling requirement (every or-list in the corpus has a
//      notated sibling either way), and the VERB rule's left-hand guard (zero
//      corpus occurrences). hasKey()'s limb clause is a fourth, and is left
//      undefended on purpose: it is redundant with rule 3, which the harness
//      confirmed by dropping it and watching rule 3 still catch the mutant.
//   o. AN EXERCISE WITH NO DRAWN NOTEHEAD IS SKIPPED WHOLE. The sweep returns
//      early when the census is empty, on the reasoning that there is no stave
//      to contradict. practice-systems#1 is the one such exercise in the corpus
//      — a journal template drawn as four visible rests — and its words name the
//      kick, the hat and the snare inside a sample journal entry. Nothing here
//      reads them. Correct today; it would also hide a real exercise that lost
//      all its notes.
//   b. THE CONVERSE IS NOT CHECKED. A key on the stave that no word names is
//      invisible here. Most exercises do not enumerate their kit, so requiring
//      it would fail hundreds of true pages; but it means a stave that GAINS a
//      wrong voice, rather than mis-spelling one it names, is not caught.
//   c. HI-HAT STICK VERSUS FOOT IS DELIBERATELY BLURRED. Bare "hat"/"hi-hat" is
//      satisfied by EITHER g/5/x2 or d/4/x2, because the hi-hat is one instrument
//      and the bare word does not say which limb — "Snare and Hat Building" and
//      "Flat Hi-Hat Texture" both mean the foot. Only the qualified forms
//      ("hi-hat foot", "hat foot", "hi-hat pedal") demand d/4/x2. The cost: an
//      exercise that says "hi-hat 8ths" and draws only a foot chick passes.
//   d. RIDE AND BELL SHARE A CYMBAL, so "ride" is satisfied by f/5/x2 OR e/5/x2
//      and "bell" by e/5/x2 OR f/5/x2. The site notates a ride-bell accent two
//      ways — as an accented f/5/x2 (cymbal-voicings, jazz-bop-vocabulary,
//      metal-thrash) and as e/5/x2 (latin-cascara, latin-comparsa, latin-iyesa)
//      — and both are correct, so neither can be demanded. The cost: an exercise
//      that says "ride" and draws only a mounted cowbell passes. "cowbell"
//      alone still demands e/5/x2.
//   e. GRADUATION CRITERIA ARE LESSON-SCOPED, so a criterion naming the ride is
//      satisfied by ONE exercise in the lesson having a ride. That is what makes
//      it usable, and it cuts both ways: while independence-melodic-snare was
//      wrong it needed only one exemption for four broken exercises, and now that
//      it is fixed one correct exercise would satisfy the criterion for four. The
//      lesson is not held by rule 2 at all any more — each of its exercises names
//      the ride in its own tip and is held by rule 1. See KNOWN_CLAIMED.
//   f. NO PROSE OUTSIDE EXERCISE WORDS AND GRADUATION CRITERIA IS READ. bodyHtml
//      names instruments constantly and is about the lesson, not a stave;
//      fusion-coordination-foundation's body says "The ride plays a jazz
//      pattern" and this file does not see it. Until iteration 80 its graduation
//      criterion was the only reason that lesson was caught at all — its single
//      exercise named the snare and never the ride. The exercise now says it.
//   g. NOTATION-SHORTHAND SENTENCES ARE NOT EXEMPTED, ON PURPOSE. "the accent on
//      slot 1 of each bar represents a crash + snare unison stab" is a legitimate
//      shorthand and "Ride quarters (notated on the hi-hat line — read it as the
//      ride)" is BL-099 admitting the bug in writing. Both have the same shape,
//      so a "notated as" rule would exempt the defect this file exists to find.
//      The shorthand sentences are therefore in EXEMPTIONS by name instead.
//   h. STEM DIRECTION IS ONLY HALF-CHECKED. Rule 3 catches a foot voice written
//      into `hands`. It does not catch a hand voice written into `feet`, because
//      four exercises do that on purpose (see rule 3). check-staff-positions
//      note (h) describes the same gap from the other side.
//   i. ONE WORD, ONE VOICE. "tom" alone is satisfied by any of the three toms, so
//      "move the L hand around the toms" cannot be wrong. Only the qualified
//      names bind to one key.
//   j. PRESENCE IS PER EXERCISE, NOT PER NOTEHEAD, and this is the biggest hole.
//      Moving ALL of chapin's snares onto the hi-hat line is caught; moving ONE
//      of them is not, because the others still satisfy the word. The same is
//      true of every voice: a single notehead on a wrong but legal position, in
//      an exercise that also draws that voice correctly somewhere, is invisible
//      here. Catching it needs a beat-by-beat model of what the tip says lands
//      where, which is check-tip-claims' territory and not this file's.
//   k. AN EXERCISE WHOSE WORDS NAME NOTHING IS UNCHECKED. rock-eighth-grooves#0's
//      tip never says "hat", so redrawing its hi-hat 8ths on the ride line
//      passes. That is note (b) from the other direction and it is the reason
//      rule 2 reads graduation criteria: a lesson usually names its kit even
//      when an exercise does not.
//   l. STRUCTURE, NOT MEANING, IN TWO PLACES. "the snare or kick enters" is read
//      as an either/or because the words are joined by "or", and a bar reference
//      in an exercise that gives its own address in a longer form
//      (playing-to-a-song#3, "bar 9 of the song") reads as displacement. Both
//      are exemptions granted for the wrong reason; both currently land on
//      mentions that are exempt anyway.
//
// Exit 0 = every named instrument is on its stave.
// `--survey` prints every mention and its verdict without failing.
// `--defects` prints only the unexempted misses, exemption list included.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const lessonContent = require(path.join(ROOT, 'src/_data/lessonContent.js'));
const { renderPattern } = require(path.join(ROOT, 'tools/notation-renderer.js'));

const SURVEY = process.argv.includes('--survey');
const DEFECTS = process.argv.includes('--defects');

function die(msg) { console.error(`[check-named-voices] FAIL — ${msg}`); process.exit(1); }

// ===========================================================================
// THE VOICE MAP — read from player.js, asserted against the verified table.
// ===========================================================================
const EXPECTED_MAP = {
  'b/5/x2': 'china', 'a/5/x2': 'crash', 'g/5/x2': 'hat', 'f/5/x2': 'ride',
  'e/5/x2': 'bell', 'e/5': 'tomHigh', 'd/5': 'tomMid', 'c/5': 'snare',
  'a/4': 'tomFloor', 'f/4': 'kick', 'd/4/x2': 'foot',
};
// Centre y of each notehead, from iterations 74 and 76. Re-measured every run.
const EXPECTED_Y = {
  'b/5/x2': 43, 'a/5/x2': 48, 'g/5/x2': 53, 'f/5/x2': 58, 'e/5/x2': 63,
  'e/5': 63, 'd/5': 68, 'c/5': 73, 'a/4': 83, 'f/4': 93, 'd/4/x2': 103,
};

const playerSrc = fs.readFileSync(path.join(ROOT, 'src/assets/js/player.js'), 'utf8');
const mapBlock = /KEY_TO_DRUM\s*=\s*\{([\s\S]*?)\}/.exec(playerSrc);
if (!mapBlock) die('KEY_TO_DRUM not found in player.js');
const KEY_TO_DRUM = {};
for (const m of mapBlock[1].matchAll(/'([^']+)'\s*:\s*'([^']+)'/g)) KEY_TO_DRUM[m[1]] = m[2];

for (const [key, drum] of Object.entries(EXPECTED_MAP)) {
  if (KEY_TO_DRUM[key] !== drum) {
    die(`player.js maps ${key} to ${JSON.stringify(KEY_TO_DRUM[key])}, this file expects ${JSON.stringify(drum)}. ` +
      'The voice map moved under the vocabulary below; do not edit one without the other.');
  }
}
for (const key of Object.keys(KEY_TO_DRUM)) {
  if (!EXPECTED_MAP[key]) die(`player.js maps a key this file has never heard of: ${key}. Add it to the table and the vocabulary.`);
}

// Notehead ink centre, measured off the real renderer. Not used for matching —
// matching is by key identity, because the bell and the high tom share a
// position — but measured so the table in the header above cannot rot, and so
// that the one fact the identity rule rests on (e/5/x2 and e/5 ARE the same
// position) is asserted rather than remembered.
function centreY(key) {
  const svg = renderPattern({ timeSignature: '4/4', hands: [{ keys: [key], duration: 'w' }] });
  const headG = /<g class="vf-notehead"[\s\S]*?<\/g>/.exec(svg);
  if (!headG) return null;
  const dm = /<path[^>]*\sd="([^"]*)"/.exec(headG[0]);
  if (!dm) return null;
  const ys = (dm[1].match(/[-+]?(?:\d*\.\d+|\d+\.?)/g) || []).map(Number)
    .filter((_, i) => i % 2 === 1);
  if (!ys.length) return null;
  return (Math.min(...ys) + Math.max(...ys)) / 2;
}
const measured = {};
for (const key of Object.keys(EXPECTED_MAP)) {
  const y = centreY(key);
  if (y === null) die(`the renderer drew no notehead for ${key}`);
  measured[key] = y;
  // The control-point hull over-reports a bezier's extent, so this is a
  // half-space-tolerant sanity rail on the TABLE, not a precision instrument;
  // check-staff-positions owns the exact geometry and calibrates against ledger
  // lines. 3 units is well under the 5-unit half-space that separates positions.
  if (Math.abs(y - EXPECTED_Y[key]) > 3) {
    die(`${key} measures y=${y.toFixed(2)}, the verified table says ${EXPECTED_Y[key]}. ` +
      'The renderer moved; re-verify the table in this file\'s header before trusting any of it.');
  }
}
if (Math.abs(measured['e/5/x2'] - measured['e/5']) > 0.5) {
  die('the bell (e/5/x2) and the high tom (e/5) no longer render on the same staff position. ' +
    'This file matches on key identity precisely because they do; if that changed, say so here.');
}

// ===========================================================================
// VOCABULARY — prose word -> the set of keys that satisfy it.
// ===========================================================================
// Longest phrase first: "hi-hat foot" must not be eaten by "hi-hat", and
// "bell of the ride" must not be split into a bell and a ride.
const RIDE_CYMBAL = ['f/5/x2', 'e/5/x2'];      // bow and bell of one cymbal — note (d)
const HI_HAT = ['g/5/x2', 'd/4/x2'];           // one instrument, two limbs — note (c)
// Unqualified "the bell" is a REGION of whichever cymbal is in play — "drop the
// cymbal volume by playing closer to the bell" is about a china. Qualified
// "ride bell" and "cowbell" stay specific, which is where the assertion has
// teeth. See note (d).
const ANY_CYMBAL_BELL = ['e/5/x2', 'f/5/x2', 'a/5/x2', 'b/5/x2'];
const VOICES = [
  ['bell of the ride', RIDE_CYMBAL], ['bell of ride', RIDE_CYMBAL], ['ride bell', RIDE_CYMBAL],
  ['hi-hat foot', ['d/4/x2']], ['hat foot', ['d/4/x2']], ['hihat foot', ['d/4/x2']],
  ['foot hi-hat', ['d/4/x2']], ['foot-played hi-hat', ['d/4/x2']], ['hi-hat pedal', ['d/4/x2']],
  ['hat pedal', ['d/4/x2']],
  // "hat-foot kick" is the left foot closing the hi-hat, not the bass drum.
  ['hat-foot kick', ['d/4/x2']], ['hi-hat foot kick', ['d/4/x2']],
  ['cross-stick', ['c/5']], ['cross stick', ['c/5']],
  ['floor tom', ['a/4']], ['floor-tom rim', ['a/4']],
  ['high tom', ['e/5']], ['hi tom', ['e/5']], ['rack tom', ['e/5']],
  ['mid tom', ['d/5']], ['middle tom', ['d/5']],
  ['bass drum', ['f/4']], ['kick drum', ['f/4']], ['kick', ['f/4']],
  ['hi-hat', HI_HAT], ['hihat', HI_HAT], ['hat', HI_HAT],
  ['snare', ['c/5']],
  ['ride', RIDE_CYMBAL],
  ['cowbell', ['e/5/x2']], ['bell', ANY_CYMBAL_BELL],
  ['crash', ['a/5/x2']],
  ['china', ['b/5/x2']],
  ['tom', ['e/5', 'd/5', 'a/4']],                    // collective — note (i)
];
const VOICE_WORDS = new Set(VOICES.map(([w]) => w));
for (const [w, keys] of VOICES) {
  for (const k of keys) if (!EXPECTED_MAP[k]) die(`vocabulary word "${w}" names ${k}, which player.js does not map`);
}
// The limb a voice must be written into, when the identity of the instrument
// depends on it. Only the two feet — see rule 3 and note (h).
const FOOT_KEYS = new Set(['f/4', 'd/4/x2']);

// ===========================================================================
// THE CORPUS
// ===========================================================================
const plain = s => String(s || '')
  .replace(/<\/(?:p|li|ul|ol|h[1-6]|div|td|tr|blockquote)>/gi, '. ')
  .replace(/<br\s*\/?>/gi, '. ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#39;|&rsquo;/g, "'")
  .replace(/&quot;/g, '"').replace(/&mdash;/g, '—').replace(/&ndash;/g, '–')
  .replace(/\s+/g, ' ').trim();

// Bar count, computed the same way audit-lessons.js does it, so "bar 5" can be
// resolved against the exercise instead of guessed at.
const TICK = { w: 4, h: 2, q: 1, 8: 0.5, 16: 0.25, 32: 0.125 };
function barsOf(ex) {
  const [num, den] = String(ex.timeSignature || '4/4').split('/').map(Number);
  const perBar = ex.expectedBeats || (num * (4 / den));
  let most = 0;
  for (const voice of ['hands', 'feet']) {
    let sum = 0, ok = true;
    (ex[voice] || []).forEach((n, i) => {
      const base = TICK[n.duration];
      if (base === undefined) { ok = false; return; }
      let t = n.dot ? base * 1.5 : base;
      const tup = (ex.tuplets || []).find(u => u.voice === voice && i >= u.start && i < u.start + u.length);
      if (tup) t *= tup.notes_occupied / tup.num_notes;
      sum += t;
    });
    if (ok && sum > most) most = sum;
  }
  if (!perBar || !most) return 1;
  return Math.max(1, Math.round(most / perBar));
}

function census(ex) {
  const byLimb = { hands: new Set(), feet: new Set() };
  for (const voice of ['hands', 'feet']) {
    for (const n of ex[voice] || []) {
      if (n.rest) continue;
      const parts = [n, ...(n.grace ? (Array.isArray(n.grace) ? n.grace : [n.grace]) : [])];
      for (const p of parts) for (const k of p.keys || n.keys || []) byLimb[voice].add(k);
    }
  }
  return byLimb;
}
// A key counts as present only where the renderer would draw it as itself: the
// two foot voices must be in `feet` (rule 3), everything else anywhere.
function hasKey(byLimb, key) {
  if (FOOT_KEYS.has(key)) return byLimb.feet.has(key);
  return byLimb.hands.has(key) || byLimb.feet.has(key);
}
const satisfied = (byLimb, keys) => keys.some(k => hasKey(byLimb, k));

function mentionsIn(text) {
  const hits = [];
  for (const [word, keys] of VOICES) {
    const re = new RegExp('\\b' + word.replace(/[-\s]/g, '[-\\s]') + '(?:e?s)?\\b', 'gi');
    let m;
    while ((m = re.exec(text))) {
      // "floor tom" must not also register as "tom", "hat foot" not as "hat".
      const prev = /([\w]+)[-\s]$/.exec(text.slice(0, m.index));
      if (prev && (VOICE_WORDS.has(`${prev[1].toLowerCase()}-${word}`)
        || VOICE_WORDS.has(`${prev[1].toLowerCase()} ${word}`))) continue;
      if (hits.some(h => h.at <= m.index && h.at + h.text.length >= m.index + m[0].length)) continue;
      hits.push({ word, keys, at: m.index, text: m[0] });
    }
  }
  return hits.sort((a, b) => a.at - b.at);
}

// ===========================================================================
// THE RULES
// ===========================================================================
const DET_AFTER = /^\s*(?:the|this|that|these|those|a|an|it|them|your|its|each|every|all)\b/i;
const NOUNY_BEFORE = /(?:\b(?:the|a|an|two|three|four|some|those|these|more|other)|[\w)]-\w+|\bnote)\s+$/i;

const ABSENT_BEFORE = /\b(?:no|not|never|without|drop|drops|dropped|dropping|omit|omits|omitted|remove|removes|removed|minus|lose|lost|skip|skips|stop|stops|stopped|silence|silences|off|free of|instead of|rather than|no longer|resist)\s+(?:the\s+|a\s+|any\s+|your\s+)?$/i;
const ABSENT_AFTER = /^\s*\S*\s*(?:is|are|stays?|stayed|remains?)?\s*(?:completely\s+|entirely\s+|still\s+)?(?:absent|omitted|silent|gone|out|tacet|doing nothing|does nothing)\b/i;
const ABSENT_CLAUSE = /\bn['’]t\b|\bnothing\b|\bhands? silent\b|\bhands off\b/i;

const DISPLACED_MARK = /\b(?:next bar|next exercise|next lesson|next downbeat|following bar|previous (?:bar|exercise)|earlier|later|not shown|not notated|isn['’]t notated|not written|before the|about to|coming|returns?|re-?add\w*|back in|in exercise \d|exercise \d|ex \d|from here|step from|you['’]ll|we['’]ll|will be)\b/ig;
// How far a displacement marker may sit from the mention it excuses. Without
// this the marker was sentence-scoped, and a sentence about one voice excused a
// different voice standing next to it: "The fill ends on the FLOOR TOM for a
// natural launch back into the kick on beat 1 of the NEXT BAR" hid a floor tom
// swapped for a mid tom, and chapin#4's "...almost on top of the NEXT DOWNBEAT
// but not quite. (The RIDE is written as straight triplets...)" hid a whole
// reverted BL-099 exercise one sentence later. Both were caught by the mutation
// harness and neither was visible by reading. 45 characters is about eight words
// — far enough for "a crash + kick on beat 1 of the next bar", short enough that
// the marker is plainly attached to the mention.
const MARK_WINDOW = 45;
// Bar references are resolved against the exercise's OWN length. "bar 5" is an
// index; "four bars" is a count. Either one bigger than what this stave draws
// puts the mention somewhere this stave is not.
const BAR_REF = /\bbars?\s+(\d+)\b/gi;
const WORD_NUM = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, sixteen: 16, twenty: 20, thirty: 30 };
const BAR_COUNT = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|sixteen|twenty|thirty)[-\s]bars?\b/gi;

const COMPARED = /\b(?:like|equivalent|similar|reminiscent|version of|compared|sounds? like|this is how|the way a|as \w+ as|than|normally|usually|would)\b|-like\b/i;

// Substitution is read at CLAUSE level: a move verb plus the preposition that
// gives it a source or a destination. `as` is deliberately absent — "read it as
// the ride" is BL-099 admitting the bug in writing, and an `as` marker exempted
// exactly the defect this file exists to find. `takes over` and `instead of`
// carry their own direction and need no preposition.
const SUBST_VERB = /\b(?:instead of|rather than|in place of|takes over|replaces?|replaced|replacing|swaps?|swapped|switch(?:es|ed)?|moves?|moved|moving|crosses to)\b/i;
const SUBST_SELF = /\b(?:instead of|rather than|in place of|takes over)\b/i;
const SUBST_PREP = /\b(?:to|from|with|onto|into)\b/i;
const SUBSTITUTED_AFTER = /^\s*\S*\s*(?:pattern\s+)?(?:is|are)\s+now\s+(?:on|in)\b|^\s*\w*\s*voice\b/i;

// Optional means THIS INSTRUMENT is optional, not merely that the sentence
// contains an "if". A bare conditional marker was tried and is far too wide:
// "If the hat-foot drags or the ride rushes when the foot lands, stay here" is
// troubleshooting, and reading it as optional exempted a real BL-099 defect. So
// an addition or relocation verb must appear alongside the condition.
const OPT_COND = /\b(?:if you|if the|if it|only if|once (?:it|you|this|the)|when you['’]re ready|optional(?:ly)?|can be|could|may want|try|experiment)\b/i;
// `voice` is NOT an action word here even though the corpus uses it as a verb
// ("Voice the floor-tom 808 ... only if the song asks"): it is a noun on nearly
// every other page ("the snare hand", "a ride voice", "the sung voice"), and as
// an action word it turned every conditional sentence containing it into an
// exemption. That sentence is carried by `only if` instead.
const OPT_ACT = /\b(?:add|adds|added|adding|bring in|put|move|moves|moving|switch|swap|layer|include|introduce|re-?add)\b/i;

const RECORDED = /\b(?:record|records|recording|sample|the original|the track|catalogue|single|album)\b/i;

// A criterion or instruction about IDENTIFYING, NAMING or WRITING an instrument
// is not a claim that this stave draws it. reading-101's "Can identify snare,
// kick, and hi-hat positions on the drum staff" is a reading test set on a
// snare-only drill, and it is correct.
// `notated` is NOT a marker and must never become one: "notated on the hi-hat
// line — read it as the ride" carries it, and so would any future confession of
// the same bug. Only the imperative `notate` and the transcription words are.
const KNOWLEDGE = /\b(?:identif\w+|recogni[sz]\w+|can name|name every|transcribe[sd]?|transcribing|transcription|notate\b|from a verbal description|on the drum staff|from memory|blank page)\b/i;

// An illustrative list — "at least three distinct timbres (cymbal wash, snare
// buzz, tom roll)" — names examples of a category, not the contents of a stave.
const EXAMPLE = /\b(?:at least \w+ distinct|such as|for example|for instance|e\.g\.)\b/i;

// Rules that are DISCLAIMERS: one of these anywhere in an exercise frees every
// other mention of the same voice there, because the exercise has said in words
// that the voice is not on this stave. VERB, COMPARED, RECORDED and EXAMPLE are
// not, because none of them says anything about what the stave contains.
//
// OTHER-BAR is deliberately NOT a disclaimer, and that distinction is
// load-bearing. playing-to-a-song#3 opens "Bar 9 — the chorus." and its bar
// numbering is the SONG's, not the exercise's, so the arithmetic reads every
// following sentence as displaced. As a disclaimer that silenced the whole
// exercise, including "Beat 1 is a crash + kick together"; as a plain exemption
// it silences only the mention next to the number. The mutation harness found
// this by swapping that crash for a china and watching nothing happen.
const DISCLAIMERS = new Set(['ABSENT', 'DISPLACED', 'SUBSTITUTED', 'ALTERNATIVE', 'OPTIONAL', 'KNOWLEDGE']);

// True when any match of `re` in `context` sits within `window` characters of
// the span [at, at+len).
function near(context, re, at, len, window) {
  re.lastIndex = 0;
  let m;
  while ((m = re.exec(context))) {
    const gap = m.index >= at + len ? m.index - (at + len)
      : at >= m.index + m[0].length ? at - (m.index + m[0].length) : 0;
    if (gap <= window) { re.lastIndex = 0; return true; }
  }
  return false;
}

// ALTERNATIVE, lifted out of classify() so selfTest() can run the real thing.
// The SATISFIED-BY-A-SIBLING requirement on the last line is the whole safety
// property — without it, "bell of ride, mounted cowbell, or even hi-hat" would
// be exempt even if the stave drew none of the three — and deleting it left the
// corpus green, so nothing but the self-test defends it.
//
// Offsets here are SENTENCE-relative, not clause-relative: the sibling comes
// from a scan of the whole sentence, and mixing the two coordinate systems
// silently mis-measured every joiner in a multi-clause sentence.
function notatedAlternative(m, sentAt, len, sentence, byLimb) {
  const sibs = mentionsIn(sentence).filter(s => s.at !== sentAt || s.word !== m.word);
  for (const s of sibs) {
    const lo = Math.min(sentAt + len, s.at + s.text.length);
    const hi = Math.max(sentAt, s.at);
    if (hi <= lo) continue;
    const joiner = sentence.slice(lo, hi);
    if (joiner.length > 30 || !/^[\s,;(\-]*or\b/i.test(joiner)) continue;
    if (satisfied(byLimb, s.keys)) return true;
  }
  return false;
}

// RULE 3, lifted out of the sweep for the same reason. Its only corpus instance
// is exempted, so the sweep can be deleted whole and every gate stays green.
function footVoicesInHands(byLimb) {
  return [...byLimb.hands].filter(k => FOOT_KEYS.has(k));
}

function classify(m, ctx) {
  const { pre, post, clause, sentence, context, ctxAt, sentAt, bars, byLimb } = ctx;
  const len = m.text.length;

  // ---- VERB: "ride" only. See the header for why no other word needs it.
  //      BOTH limbs look left. Limb (ii) originally did not, and the adversarial
  //      pass showed what that costs: "Give the ride a rest for one bar", "Hit
  //      the ride every other beat", "Accent the ride all the way through" all
  //      came out VERB, because `ride` was followed by a determiner. Every one of
  //      them is the noun with a determiner in FRONT of it, which is exactly what
  //      NOUNY_BEFORE already knew how to see. Latent rather than live — the
  //      corpus has zero occurrences today — but the header advertised the
  //      preposition exclusion as the safeguard and the hole was on the other
  //      side of the word.
  //      The guard falls THROUGH to the other rules rather than returning: "on
  //      the china instead of the ride" has a determiner in front and is still a
  //      substitution.
  if (m.word === 'ride' && !NOUNY_BEFORE.test(pre)) {
    if (/^rid(?:es|ing)$|^rode$/i.test(m.text)) return 'VERB';
    if (/^ride$/i.test(m.text) && DET_AFTER.test(post)) return 'VERB';
  }

  // ---- ABSENT
  if (ABSENT_BEFORE.test(pre)) return 'ABSENT';
  if (ABSENT_AFTER.test(post)) return 'ABSENT';
  if (ABSENT_CLAUSE.test(clause)) return 'ABSENT';

  // ---- DISPLACED (an explicit phrase, in this sentence, next to this mention).
  //      Sentence-scoped, NOT context-scoped: a phrase marker attaches to its
  //      own clause, and letting it reach back one sentence meant chapin#4's
  //      "...almost on top of the NEXT DOWNBEAT but not quite. (The RIDE is
  //      written as straight triplets...)" excused the ride 21 characters later,
  //      hiding a fully reverted BL-099 exercise. Only the numbered-bar labels
  //      below carry across a sentence, because that is how the corpus writes
  //      them ("Bars 9-12: LOUD." then the instruction on the next line).
  if (near(sentence, DISPLACED_MARK, sentAt, len, MARK_WINDOW)) return 'DISPLACED';

  // ---- KNOWLEDGE, checked before the bar arithmetic: "Notate bars 1-3 ... then
  //      the crash resolving on 1 of bar 5" is about writing, and that reading
  //      outranks the fact that a bar number happens to stand next to the word.
  if (KNOWLEDGE.test(sentence)) return 'KNOWLEDGE';

  // ---- OTHER-BAR (arithmetic against this exercise's own length)
  const nums = [];
  for (const re of [BAR_REF, BAR_COUNT]) {
    re.lastIndex = 0;
    for (const b of context.matchAll(re)) {
      const gap = b.index >= ctxAt + len ? b.index - (ctxAt + len)
        : ctxAt >= b.index + b[0].length ? ctxAt - (b.index + b[0].length) : 0;
      if (gap > MARK_WINDOW) continue;
      const n = WORD_NUM[String(b[1]).toLowerCase()] || Number(b[1]);
      if (n) nums.push(n);
    }
  }
  if (nums.length && Math.min(...nums) > bars) return 'OTHER-BAR';

  // ---- COMPARED
  if (COMPARED.test(clause)) return 'COMPARED';

  // ---- SUBSTITUTED
  if (SUBST_VERB.test(clause) && (SUBST_SELF.test(clause) || SUBST_PREP.test(clause))) return 'SUBSTITUTED';
  if (SUBSTITUTED_AFTER.test(post)) return 'SUBSTITUTED';

  // ---- ALTERNATIVE: one item of an or-list, another item of which IS notated.
  //      Satisfied-by-a-sibling, so a list whose every member is absent is still
  //      a defect. "or" must be the FIRST word between the two names, which is
  //      what separates a genuine either/or ("the bell of the ride or a mounted
  //      cowbell") from two clauses that merely happen to be joined by one ("if
  //      the hat-foot drags OR the ride rushes") — an earlier draft accepted the
  //      second and quietly exempted a real BL-099 defect.
  if (notatedAlternative(m, sentAt, len, sentence, byLimb)) return 'ALTERNATIVE';

  // ---- OPTIONAL
  if (OPT_COND.test(sentence) && OPT_ACT.test(sentence)) return 'OPTIONAL';
  if (/\boptional(?:ly)?\b|\bonly if\b/i.test(sentence)) return 'OPTIONAL';

  // ---- EXAMPLE
  if (EXAMPLE.test(sentence)) return 'EXAMPLE';

  // ---- RECORDED
  if (RECORDED.test(sentence)) return 'RECORDED';

  return null;
}

// Split a field into sentences, then clauses, keeping the offsets so `pre` and
// `post` mean "inside this clause".
function walk(text, fn) {
  let prevSentence = '';
  for (const sentence of text.split(/(?<=[.!?])\s+/)) {
    const context = `${prevSentence} ${sentence}`;
    prevSentence = sentence;
    if (!sentence.trim()) continue;
    const sentenceAt = context.length - sentence.length;
    let at = 0;
    for (const clause of sentence.split(/\s*[,;:]\s*|\s+[—–]\s+/)) {
      const start = sentence.indexOf(clause, at);
      at = start < 0 ? at : start + clause.length;
      for (const m of mentionsIn(clause)) {
        fn(m, {
          pre: clause.slice(0, m.at),
          post: clause.slice(m.at + m.text.length),
          clause, sentence, context,
          sentAt: Math.max(start, 0) + m.at,
          ctxAt: sentenceAt + Math.max(start, 0) + m.at,
        });
      }
    }
  }
}

// ===========================================================================
// EXEMPTIONS — one exercise, one voice, each tied to the item that retires it.
// ===========================================================================
// Scoped to a single exercise AND a single voice, never to a lesson and never to
// a whole exercise, because iteration 70's mutation audit found the commonest
// defect in this project's gates was an exemption broader than its author
// realised. Every entry must be USED: an entry whose defect has been fixed makes
// this file FAIL until the entry is deleted, so the list can only shrink.
// EXEMPTION_COUNT is a second rail, asserted by EQUALITY so the number has to
// move in the same diff as the list.
//
// ---------------------------------------------------------------------------
// BL-099 IS CLOSED. Chunk 3 landed at iteration 80 and this file no longer
// carries a single BL-099 entry. The rule the campaign was run under, kept
// because the next `ex: null` entry will need it:
//
// CONVERT EACH LESSON ATOMICALLY, IN ONE COMMIT. A `ex: null` entry is
// LESSON-scoped: it exists only while the lesson has no ride ANYWHERE.
// Fixing one exercise in the lesson satisfies the criterion, retires the entry,
// and takes the tripwire with it — and the exercises that entry was covering do
// not say "ride" in their own words, so there is no miss left to exempt and
// nothing to re-add. Half a lesson is worse than none.
//
// The final accounting, measured at iteration 77 and closed at iteration 80:
//
//   20 exercises across the five lessons BL-099 named
//   18 drew a hand hi-hat and no ride
//    2 of those 18 are DELIBERATE and must not be swept — three-limb-patterns
//      #2 and #3, "the rock starting pair", recorded in BL-099's own iteration-76
//      note. So the defect set was 16, which is the number the item states.
//   11 of the 16 were converted at iteration 78 (chunk 2): three-limb #0/#1/#4,
//      four-way #0-#4, clave-foot #1/#2/#4. Count the EXERCISES and the ENTRIES
//      separately, because they are different numbers and an earlier draft of
//      this paragraph ran them together in the direction that flattered the
//      change. 11 exercises; 11 entries, but not one each — 8 per-exercise
//      (three-limb 0/1/4, four-way 0/1, clave-foot 1/2/4) plus 3 grad, one per
//      lesson. THREE of the 11 exercises, four-way #2/#3/#4, never had an entry
//      of their own and stood behind their lesson's grad entry alone, which is
//      why all three lessons had to move together.
//    5 were converted at iteration 80 (chunk 3): independence-melodic-snare
//      #0-#3 and fusion-coordination-foundation #0, 54 noteheads, two `ex: null`
//      grad entries retired. Both lessons moved whole, for the reason above:
//      independence-melodic-snare's four exercises stood behind ONE lesson-scoped
//      entry, so the first fix in the lesson would have deleted the tripwire off
//      the other three.
//   16 of 16 converted. Not one of the five chunk-3 exercises named the ride in
//      its own title, meta or tip — they named the snare, and #2 the hat-foot,
//      but never the cymbal their right hand was playing. That is why the sweep
//      that filed BL-099 missed them, and why converting them would have left
//      them UNBOUND: nothing in their own words to contradict a stave that
//      drifted back. Each tip therefore gained one true sentence naming the
//      ride, so rule 1 now holds all five per exercise and not merely per
//      lesson. Those five sentences are the whole binding, so they are listed in
//      KNOWN_CLAIMED below as well.
//
// WHAT THE WHOLE CAMPAIGN LEAVES BEHIND, measured at iteration 80 by reverting
// each converted exercise on its own and asking this gate whether it notices.
// 25 exercises over 7 lessons were converted across the three chunks — the
// original nine (jazz-ride-pattern #0-#3, independence-chapin-method #0-#4),
// chunk 2's eleven, chunk 3's five. 24 of the 25 are BOUND: revert the stave
// alone and this file fails, naming the exercise. ONE is not:
//
//   jazz-ride-pattern#2 "Add the Hi-Hat Foot on 2 and 4" — six ride noteheads
//   whose title, meta and tip name only the hi-hat foot. Its lesson criterion
//   "Ride pattern + hi-hat foot on 2 and 4" is satisfied by its three siblings,
//   so rule 2 stays quiet too. Move its ride to the hi-hat line today and every
//   gate is green. That is note (e) and note (j) meeting on one page, and it is
//   the BL-127 class rather than a BL-099 defect: the NOTATION is correct and
//   nothing exempts it, so there is no entry to add here. It wants one true
//   sentence in its tip, the fix chunk 3 applied five times.
const EXEMPTIONS = [
  // --- BL-099 chunk 2 RETIRED at iteration 78. Eleven entries deleted in one
  //     diff — 8 per-exercise (three-limb-patterns 0/1/4, four-way-foundation
  //     0/1, independence-clave-foot 1/2/4) and ALL THREE `ex: null` grad
  //     entries, one per lesson — because all three lessons were converted
  //     atomically as the note above demanded: 11 exercises, 108 noteheads,
  //     g/5/x2 -> f/5/x2.
  //
  //     Losing three grad entries is exactly the tripwire loss described above,
  //     so here is the safety argument per lesson rather than a blanket one.
  //     four-way-foundation and independence-clave-foot are simple: every
  //     exercise in them that has a hand voice at all now draws the ride, and
  //     clave-foot #0/#3 have no hand voice to be wrong about.
  //     three-limb-patterns is NOT that case and must not be described as one:
  //     #2 and #3 keep their hi-hat hand on purpose and are still on the hi-hat
  //     line. What makes deleting its grad entry safe is that its
  //     graduationCriteria carry TWO tracks and both are now correctly notated —
  //     criterion [0] "Ride + hi-hat foot 2 and 4 + snare on 2 and 4" by the
  //     converted #0/#1, criterion [1] "Hi-hat hand + kick 1 and 3 + snare 2 and
  //     4 (rock-style three-limb)" by the untouched #2/#3. The entry was
  //     exempting a criterion that has become true, not covering a defect.
  // --- BL-099 chunk 3 RETIRED at iteration 80. Two `ex: null` grad entries
  //     deleted, independence-melodic-snare and fusion-coordination-foundation.
  //     The tripwire argument that made chunk 2 safe does not transfer to these
  //     two, because their exercises never named the ride at all, so it was
  //     rebuilt rather than reused: every one of the five now says "ride" in its
  //     own tip, which means each stave is held by rule 1 individually. Deleting
  //     the lesson-scoped entries costs nothing that the per-exercise claims do
  //     not now cover, and both lessons have a ride in every exercise they have.
  //     Mutation-checked at iteration 80: reverting any ONE of the five back to
  //     g/5/x2 fails this gate by name.

  // --- BL-089, already filed: "two tips naming a voice that is not on the
  //     stave". three-limb-patterns#4's tip says "then add the hat foot on 2 and
  //     4" and no d/4/x2 is drawn, while its siblings #0 and #1 do notate one.
  //     Its ride half was BL-099's and is fixed; the missing hat foot is this
  //     one, and it is untouched.
  //
  //     Iteration 78 retitled the exercise from "Hi-Hat + Kick + Ride" to "Ride +
  //     Kick + Hat Foot". Two halves of that, and only one was forced. REMOVING
  //     the bare "Hi-Hat" was: it was satisfied only by the mis-notated hand, so
  //     converting the hand to a ride turns it into an unexempted miss, and this
  //     list may only shrink. NAMING a third, un-notated limb in its place was
  //     DISCRETIONARY — "Ride Over a Syncopated Kick" and "Ride + Kick" both pass
  //     too. It was chosen because "Three-Limb Combo C" already commits the page
  //     to three limbs, so a two-limb tail relocates the overclaim rather than
  //     removing it. The cost, stated rather than buried: BL-089's un-notated
  //     claim now appears on the page's most prominent line as well as in the
  //     tip. The gate count is unchanged at one pair; the READER now meets it
  //     twice.
  //
  //     THE TITLE'S SPELLING IS COUPLED TO THIS ENTRY'S TOKEN. It falls under
  //     this entry only while it says "Hat Foot": the vocabulary has separate
  //     tokens for `hat foot` and `hi-hat foot`, and this entry is keyed to the
  //     first. Normalising the title to "Hi-Hat Foot" — which is what its own
  //     sibling #0 "Pair: Ride + Hi-Hat Foot" uses, so the lesson is internally
  //     inconsistent about the voice's name — FAILS this gate with no content
  //     defect at all. Whoever closes BL-089 should fix the spelling and the
  //     notation together; whoever only tidies the spelling will get a red gate
  //     and should add `hi-hat foot` here rather than reverting the wording.
  { slug: 'three-limb-patterns', ex: 4, voice: 'hat foot', why: 'BL-089' },

  // --- FOUND BY THIS GATE, iteration 77, not yet filed. Four exercises and one
  //     lesson's graduation criteria, across three rock lessons, instruct a crash
  //     on beat 1 and notate none. The site draws a crash in 7 exercises out of
  //     852 in total, so this is a convention gap rather than four typos, and it
  //     wants one decision (notate a/5/x2, or reword) rather than four.
  //     rock-stadium-anthem#2's tip already
  //     documents the workaround — "the accent on slot 1 of each bar represents
  //     a crash + snare unison stab" — and note (g) explains why that sentence
  //     is deliberately not turned into a rule.
  { slug: 'rock-stadium-anthem', ex: 2, voice: 'crash', why: 'un-notated crash class (iter 77, unfiled)' },
  { slug: 'rock-stadium-anthem', ex: 3, voice: 'crash', why: 'un-notated crash class (iter 77, unfiled)' },
  { slug: 'rock-stadium-anthem', ex: null, voice: 'crash', why: 'un-notated crash class (iter 77, unfiled)' },
  { slug: 'rock-studio-polish', ex: 2, voice: 'crash', why: 'un-notated crash class (iter 77, unfiled)' },
  { slug: 'rock-dynamics', ex: 2, voice: 'crash', why: 'un-notated crash class (iter 77, unfiled)' },

  // --- FOUND BY THIS GATE, iteration 77, not yet filed. independence-singing#1
  //     tells the reader to play "the basic backbeat (kick 1 and 3, snare 2 and
  //     4, hi-hat 8ths)" over a stave that has no hat in either limb. Its
  //     sibling #0 prescribes the same hats and says "(not notated above; play
  //     them)", so the lesson knows how to say it and this exercise does not.
  { slug: 'independence-singing', ex: 1, voice: 'hi-hat', why: 'undisclosed un-notated hat (iter 77, unfiled)' },
];
// A RATCHET, not a ceiling, and the assertion is EQUALITY. A `<=` bound does not
// ratchet: once chunk 2 retires five entries, a bound of 20 silently permits
// five new ones. With equality you cannot add or remove a single entry without
// editing this number in the same diff, which is the point — the number is the
// reviewable artefact, not the array. Lower it with every retirement.
const EXEMPTION_COUNT = 7;

// Rule 3's one known exception, and it already has an item of its own whose
// acceptance ends "and no other exercise puts a kick in the hands voice" — so
// this entry retires with BL-118 and the assertion widens to zero by itself.
const LIMB_EXEMPTIONS = [
  { slug: 'playing-to-a-song', ex: 3, key: 'f/4', why: 'BL-118' },
];
const LIMB_COUNT = 1;

function exemptedBy(slug, exIndex, word) {
  return EXEMPTIONS.find(e => e.slug === slug && e.ex === exIndex && e.voice === word);
}

// The eleven false positives BL-123 named, with the rule each one must come out
// clean UNDER. Asserted, not commented: a rule that stops catching one of these,
// or starts catching it for a different reason, fails this gate.
const KNOWN_CLEAN = [
  ['the-shuffle', 3, 'ride', 'DISPLACED'],
  ['the-shuffle', 3, 'ride bell', 'SUBSTITUTED'],
  ['jazz-brushes-intro', 2, 'ride', 'COMPARED'],
  ['jazz-broken-time', 1, 'ride', 'SUBSTITUTED'],
  ['triplet-feel', 3, 'ride', 'COMPARED'],
  ['latin-guaguanco', 3, 'ride', 'VERB'],
  ['rock-open-hats', 0, 'ride', 'VERB'],
  ['accompaniment', 1, 'ride', 'OTHER-BAR'],
  ['snare-voicings', 2, 'ride', 'VERB'],
  ['ghost-notes-found', 3, 'ride', 'VERB'],
  ['metal-metric-modulation', 2, 'ride', 'VERB'],
  ['odd-meters-9-8', 0, 'ride', 'VERB'],
];

// The other half of the same assertion, and the more important half: mentions
// that must still be read as CLAIMS ON THE STAVE. These are the eight of the
// nine BL-099 exercises whose own words say "ride" (jazz-ride-pattern#2 says
// only "hi-hat foot"; the lesson body is what makes it one of the nine). They
// pass today because the ride is now notated — so nothing here would fail if a
// rule quietly started exempting them, and the gate would go blind to the exact
// class it was built for. Asserting the VERDICT rather than the outcome is what
// catches that: widening MARK_WINDOW back to a whole sentence, for instance,
// re-hides chapin#4 and fails here.
const KNOWN_CLAIMED = [
  ['jazz-ride-pattern', 0, 'ride'], ['jazz-ride-pattern', 1, 'ride'], ['jazz-ride-pattern', 3, 'ride'],
  ['independence-chapin-method', 0, 'ride'], ['independence-chapin-method', 1, 'ride'],
  ['independence-chapin-method', 2, 'ride'], ['independence-chapin-method', 3, 'ride'],
  ['independence-chapin-method', 4, 'ride'],
  // Three more chosen because each one sits behind a rule that could widen
  // without the corpus noticing: playing-to-a-song#3 is the exercise whose bar
  // numbering is the SONG's (promote OTHER-BAR to a disclaimer and its crash
  // goes dark), rock-open-hats#0 is the hat's counterpart to the BL-099 ride,
  // and fills-around-kit#0's floor tom stands 55 characters from a "next bar"
  // that belongs to the kick.
  ['playing-to-a-song', 3, 'crash'],
  ['rock-open-hats', 0, 'hat'],
  ['fills-around-kit', 0, 'floor tom'],
  // BL-099 chunk 3, iteration 80. These five are here for a different reason
  // from every entry above: their "ride" sentences were WRITTEN in that
  // iteration, and they are the only thing binding those staves. Chunk 3's
  // lessons said "ride" in their graduation criteria and nowhere else, so
  // deleting the two lesson-scoped exemptions would have left the exercises
  // unbound — rule 2 is satisfied by one ride anywhere in the lesson. A tip
  // sentence is content, and content gets reworded: if one of these is rewritten
  // into a hedge, or a rule widens far enough to swallow it, that stave silently
  // stops being checked and no miss appears, because the ride IS notated today.
  // This list is what notices. Re-derive rather than delete.
  ['independence-melodic-snare', 0, 'ride'], ['independence-melodic-snare', 1, 'ride'],
  ['independence-melodic-snare', 2, 'ride'], ['independence-melodic-snare', 3, 'ride'],
  ['fusion-coordination-foundation', 0, 'ride'],
];

// ===========================================================================
// SELF-TESTS — the rules the corpus cannot defend.
// ===========================================================================
// Three rules were deletable in silence: rule 3 (its only corpus instance is
// exempted, and the exemption sets `used` before the finding is pushed, so the
// scan can be removed whole), ALTERNATIVE's satisfied-by-a-sibling requirement
// (the corpus's four or-lists all have a notated sibling either way), and the
// VERB rule's new left-hand guard (zero corpus occurrences). Each is asserted
// here on synthetic input, through the same functions the sweep uses. This is
// the pattern check-staff-positions' selfTestRule5() established.
(function selfTest() {
  const stave = (hands, feet) => ({ hands: new Set(hands), feet: new Set(feet || []) });

  // --- RULE 3
  if (!footVoicesInHands(stave(['f/4', 'c/5'])).length) {
    die('self-test: a kick in the HANDS voice was not reported. Rule 3 has been reduced to something ' +
      'that cannot fire, and the corpus cannot tell you — its only instance is exempted under BL-118.');
  }
  if (footVoicesInHands(stave(['c/5'], ['f/4', 'd/4/x2'])).length) {
    die('self-test: rule 3 reported a foot voice that is correctly in the feet array.');
  }

  // --- ALTERNATIVE's sibling requirement
  const alt = (s, hands) => {
    const hits = mentionsIn(s).filter(h => h.word === 'crash');
    if (hits.length !== 1) die(`self-test: "${s}" should mention the crash exactly once`);
    return notatedAlternative(hits[0], hits[0].at, hits[0].text.length, s, stave(hands));
  };
  const orList = 'Use the china or the crash for this accent.';
  if (!alt(orList, ['b/5/x2'])) {
    die('self-test: an either/or whose OTHER member is notated was not exempted as ALTERNATIVE.');
  }
  if (alt(orList, ['c/5'])) {
    die('self-test: an either/or was exempted although NEITHER member is on the stave. The ' +
      'satisfied-by-a-sibling requirement is the only thing that stops "X or Y" excusing a stave ' +
      'that draws no X and no Y, and no sentence in the corpus exercises it.');
  }

  // --- VERB, both limbs, and the left-hand guard on limb (ii)
  const verdict = text => {
    const out = [];
    walk(text, (m, w) => {
      if (m.word !== 'ride') return;
      out.push(classify(m, { ...w, bars: 1, byLimb: stave(['c/5']) }));
    });
    if (out.length !== 1) die(`self-test: "${text}" should hold exactly one "ride", it held ${out.length}`);
    return out[0];
  };
  for (const t of ['The right hand rides the hat all bar.', 'Ride the offbeats here.']) {
    if (verdict(t) !== 'VERB') die(`self-test: "${t}" is the verb and was read as ${verdict(t)}.`);
  }
  for (const t of ['Give the ride a rest for one bar.', 'Hit the ride every other beat.',
    'Accent the ride all the way through.']) {
    if (verdict(t) === 'VERB') {
      die(`self-test: "${t}" is the NOUN with a determiner in front of it and was read as the verb. ` +
        'Limb (ii) of the VERB rule has stopped looking left.');
    }
  }
})();

// ===========================================================================
// THE SWEEP
// ===========================================================================
const misses = [];         // unexempted: the gate fails on these
const exempted = [];       // matched an entry in EXEMPTIONS
const verdicts = [];       // every mention, for --survey and for KNOWN_CLEAN
let mentionCount = 0, pairCount = 0, limbScanned = 0;
const limbFindings = [];
// How LOAD-BEARING each rule is: the number of exercise/voice pairs where the
// voice is absent from the stave and the rule is one of the reasons this file
// stays quiet. A rule that fires 500 times on voices that are present is not
// broad; a rule that silences 50 absent ones is. This is the number to read.
const loadBearing = new Map();
const loadExamples = new Map();
// Pairs the DISCLAIMED rule silenced. Tracked separately because the raw CLAIM
// verdicts stay in `verdicts` for the survey, and KNOWN_CLAIMED must ask whether
// the claim still COUNTS, not merely whether it was parsed.
const disclaimed = new Set();
const disclaimedButSatisfied = new Set();

function sweep(slug, exIndex, ex, byLimb, bars, fields, scope) {
  // word -> { keys, prescribed: [...], hedged: Set(rule), samples: [...] }
  const seen = new Map();
  for (const [field, raw] of fields) {
    const text = plain(raw);
    if (!text) continue;
    walk(text, (m, w) => {
      mentionCount++;
      const rule = classify(m, { ...w, bars, byLimb });
      const rec = seen.get(m.word) || { keys: m.keys, prescribed: [], hedged: new Set(), where: [] };
      rec.where.push({ field, rule, clause: w.clause.trim() });
      if (rule) rec.hedged.add(rule); else rec.prescribed.push({ field, clause: w.clause.trim() });
      seen.set(m.word, rec);
      verdicts.push({ slug, ex: exIndex, word: m.word, rule, field, clause: w.clause.trim() });
    });
  }
  for (const [word, rec] of seen) {
    pairCount++;
    // Recorded for EVERY pair, present or absent. Doing it only for absent ones
    // was a hole the mutation harness found: promoting OTHER-BAR to a disclaimer
    // silences playing-to-a-song#3's crash, but that crash IS notated, so the
    // pair returned early and KNOWN_CLAIMED never saw it go quiet.
    const isDisclaimed = rec.prescribed.length && [...rec.hedged].some(r => DISCLAIMERS.has(r));
    if (isDisclaimed) disclaimed.add(`${slug}#${exIndex}|${word}`);
    if (satisfied(byLimb, rec.keys)) {
      // Counted even though it passes: a DISCLAIMED pair whose voice happens to
      // be notated is a pair this gate would not miss if the notation broke.
      if (isDisclaimed) disclaimedButSatisfied.add(`${slug}#${exIndex}|${word}`);
      continue;
    }
    const tag = `${slug}#${exIndex === null ? 'grad' : exIndex}[${word}]`;
    for (const r of rec.hedged) {
      loadBearing.set(r, (loadBearing.get(r) || 0) + 1);
      if (!loadExamples.has(r)) loadExamples.set(r, []);
      loadExamples.get(r).push(`${tag} :: ${(rec.where.find(w => w.rule === r) || {}).clause}`);
    }
    if (!rec.prescribed.length) continue;                    // every mention hedged
    if (isDisclaimed) {                                       // DISCLAIMED
      rec.prescribed.forEach(p => verdicts.push({
        slug, ex: exIndex, word, rule: 'DISCLAIMED', field: p.field, clause: p.clause,
      }));
      continue;
    }
    const row = {
      slug, ex: exIndex, scope, word, keys: rec.keys,
      have: [...byLimb.hands].concat([...byLimb.feet].map(k => `${k}(feet)`)).join(' '),
      clause: rec.prescribed[0].clause, field: rec.prescribed[0].field,
      n: rec.prescribed.length,
    };
    const exempt = exemptedBy(slug, exIndex, word);
    if (exempt) { exempt.used = true; exempted.push({ ...row, why: exempt.why }); }
    else misses.push(row);
  }
}

for (const [slug, lesson] of Object.entries(lessonContent)) {
  const exercises = lesson.exercises || [];

  (exercises).forEach((ex, i) => {
    const byLimb = census(ex);
    if (!byLimb.hands.size && !byLimb.feet.size) return;      // no stave to contradict
    sweep(slug, i, ex, byLimb, barsOf(ex), [
      ['title', ex.title], ['meta', ex.meta], ['tip', ex.tip],
    ], 'exercise');

    // ---- RULE 3: the two foot voices must be written in `feet`.
    limbScanned++;
    for (const key of footVoicesInHands(byLimb)) {
      const ok = LIMB_EXEMPTIONS.find(e => e.slug === slug && e.ex === i && e.key === key);
      if (ok) { ok.used = true; continue; }
      limbFindings.push({ slug, ex: i, key, drum: KEY_TO_DRUM[key] });
    }
  });

  // ---- RULE 2: graduation criteria, lesson-scoped.
  const crit = lesson.graduationCriteria || [];
  if (crit.length && exercises.length) {
    const lessonLimb = { hands: new Set(), feet: new Set() };
    let maxBars = 1;
    for (const ex of exercises) {
      const c = census(ex);
      c.hands.forEach(k => lessonLimb.hands.add(k));
      c.feet.forEach(k => lessonLimb.feet.add(k));
      maxBars = Math.max(maxBars, barsOf(ex));
    }
    if (lessonLimb.hands.size || lessonLimb.feet.size) {
      sweep(slug, null, null, lessonLimb, maxBars,
        crit.map((g, i) => [`grad[${i}]`, g]), 'lesson');
    }
  }
}

// ===========================================================================
// SELF-CHECKS ON THE GATE ITSELF
// ===========================================================================
const selfFail = [];

// The eleven must be clean, each for the recorded reason.
for (const [slug, i, word, rule] of KNOWN_CLEAN) {
  const hits = verdicts.filter(v => v.slug === slug && v.ex === i && v.word === word);
  if (!hits.length) {
    selfFail.push(`${slug}#${i} no longer mentions "${word}" at all — KNOWN_CLEAN is stale, and one of the ` +
      'eleven false positives BL-123 named is no longer being exercised by this gate.');
    continue;
  }
  const bad = hits.filter(h => h.rule !== rule);
  if (bad.length) {
    selfFail.push(`${slug}#${i} "${word}" was expected to be exempt as ${rule}; ` +
      `got ${bad.map(b => b.rule || 'A CLAIM ON THE STAVE').join('/')} — "${bad[0].clause.slice(0, 90)}"`);
  }
}

// The BL-099 sentences must still be read as claims, not merely come out green.
for (const [slug, i, word] of KNOWN_CLAIMED) {
  const hits = verdicts.filter(v => v.slug === slug && v.ex === i && v.word === word);
  if (!hits.length) {
    selfFail.push(`${slug}#${i} no longer mentions "${word}" at all. That sentence is the only thing that ` +
      'made BL-099 visible; if it was reworded, KNOWN_CLAIMED needs re-deriving, not deleting.');
  } else if (!hits.some(h => h.rule === null) || disclaimed.has(`${slug}#${i}|${word}`)) {
    const rules = [...new Set(hits.map(h => h.rule).filter(Boolean))];
    const how = disclaimed.has(`${slug}#${i}|${word}`)
      ? `freed by DISCLAIMED, on the strength of ${rules.join('/') || 'another mention'}`
      : `exempt as ${rules.join('/')}`;
    selfFail.push(`${slug}#${i} "${word}" is no longer read as a claim on the stave — ${how}. ` +
      'KNOWN_CLAIMED lists mentions that PASS today anyway (the voice is notated), so no miss and no ' +
      'coverage floor would have noticed this gate going blind to them. Narrow the rule that swallowed it, ' +
      'rather than deleting the entry.');
  }
}

// An exemption whose defect is gone must be deleted, not left to rot.
const stale = EXEMPTIONS.filter(e => !e.used);
if (stale.length) {
  selfFail.push(...stale.map(e => `EXEMPTIONS still carries ${e.slug}#${e.ex === null ? 'grad' : e.ex} ` +
    `"${e.voice}" (${e.why}) but the corpus no longer produces that miss. Delete the entry — the list is ` +
    'allowed to shrink and nothing else.'));
}
const staleLimb = LIMB_EXEMPTIONS.filter(e => !e.used);
if (staleLimb.length) {
  selfFail.push(...staleLimb.map(e => `LIMB_EXEMPTIONS still carries ${e.slug}#${e.ex} ${e.key} (${e.why}) ` +
    'but that key is no longer in the hands voice. Delete the entry.'));
}
if (EXEMPTIONS.length !== EXEMPTION_COUNT) {
  selfFail.push(`EXEMPTIONS holds ${EXEMPTIONS.length} entries and EXEMPTION_COUNT says ${EXEMPTION_COUNT}. ` +
    (EXEMPTIONS.length > EXEMPTION_COUNT
      ? 'The list has grown. A new miss is a content bug to fix, not an entry to add — and if it truly must '
        + 'be exempted, raising this number is the deliberate act that records it.'
      : 'The list has shrunk, which is the intended direction: lower this number in the same commit so it '
        + 'keeps ratcheting. Leaving it high would silently re-permit the entries you just retired.'));
}
if (LIMB_EXEMPTIONS.length !== LIMB_COUNT) {
  selfFail.push(`LIMB_EXEMPTIONS holds ${LIMB_EXEMPTIONS.length} entries and LIMB_COUNT says ${LIMB_COUNT}.`);
}
// Rule 3 has to have LOOKED. Its one corpus instance is exempted, and the
// exemption marks itself used before any finding is pushed, so deleting the scan
// leaves no stale entry and no finding — the count is the only witness.
if (limbScanned < 800) {
  selfFail.push(`rule 3 examined ${limbScanned} exercises, expected all 852. The limb scan has been ` +
    'removed or narrowed, and nothing else in this file would have noticed.');
}

// A gate that quietly stops reading the corpus is worse than one that fails.
// Measured when this file was written, iteration 77: 3398 instrument mentions
// across 2043 exercise/voice and lesson/voice pairs, over 852 exercises and 217
// lessons. The ~1.5% gap absorbs a reworded tip; a bigger drop is erosion of the
// parser and should be looked at, not waved through.
const MENTION_FLOOR = 3350;
const PAIR_FLOOR = 2010;
if (mentionCount < MENTION_FLOOR || pairCount < PAIR_FLOOR) {
  selfFail.push(`coverage floor breached: ${mentionCount} mentions / ${pairCount} pairs, ` +
    `floors are ${MENTION_FLOOR}/${PAIR_FLOOR}. The parser is reading less of the corpus than when the ` +
    'floors were set. Fix the parser, or lower the floor in the commit that explains why.');
}

// ===========================================================================
// REPORT
// ===========================================================================
if (SURVEY) {
  const byRule = {};
  verdicts.forEach(v => { byRule[v.rule || 'CLAIM'] = (byRule[v.rule || 'CLAIM'] || 0) + 1; });
  for (const v of verdicts) {
    console.log(`${(v.rule || 'CLAIM').padEnd(12)} ${v.slug}#${v.ex === null ? 'grad' : v.ex} ` +
      `[${v.word}] ${v.field}: ${v.clause.slice(0, 110)}`);
  }
  console.log(`\n[survey] ${mentionCount} mentions, ${pairCount} pairs, ${misses.length} unexempted misses, ` +
    `${exempted.length} exempted`);
  console.log('  by rule: ' + Object.entries(byRule).map(([k, n]) => `${k}=${n}`).join(' '));
  process.exit(0);
}
if (DEFECTS) {
  for (const r of [...misses.map(m => ({ ...m, tag: 'MISS' })), ...exempted.map(m => ({ ...m, tag: 'exempt' }))]) {
    console.log(`${r.tag.padEnd(7)} ${r.slug}#${r.ex === null ? 'grad' : r.ex} [${r.word}] ` +
      `wants ${r.keys.join('|')} · has ${r.have || '(none)'} · ${r.why || ''}`);
    console.log(`        ${r.field}: ${r.clause.slice(0, 150)}`);
  }
  console.log(`\n${misses.length} unexempted, ${exempted.length} exempted, ${limbFindings.length} limb findings`);
  console.log('\nload-bearing rules (absent-voice pairs each one keeps quiet):');
  const distinct = new Set();
  let tuples = 0;
  for (const [r, n] of [...loadBearing].sort((a, b) => b[1] - a[1])) {
    tuples += n;
    console.log(`  ${r} — ${n}`);
    (loadExamples.get(r) || []).forEach(e => {
      distinct.add(e.split(' :: ')[0]);
      console.log(`      ${e.slice(0, 150)}`);
    });
  }
  console.log(`\n  ${tuples} (rule, pair) tuples over ${distinct.size} distinct pairs — ` +
    `${tuples - distinct.size} pairs are hedged by more than one rule.`);
  // The blast radius of note (a). These pairs pass today because the voice IS
  // notated, but one hedged mention anywhere in the exercise has already freed
  // every other mention of it, so breaking the notation would go unnoticed.
  console.log(`  ${disclaimed.size} exercise/voice pairs are DISCLAIMED: ${disclaimedButSatisfied.size} of them ` +
    `are satisfied today, so breaking their notation would go unnoticed (note a); the other ` +
    `${disclaimed.size - disclaimedButSatisfied.size} are absent voices this rule is actively excusing.`);
  console.log('  Copy these two numbers into the header ledger; do not retype them from an older run.');
  process.exit(0);
}

if (misses.length || limbFindings.length || selfFail.length) {
  console.error('[check-named-voices] FAIL:');
  for (const m of misses) {
    console.error(`  ${m.slug}#${m.ex === null ? ' graduationCriteria' : m.ex}  names the ${m.word}, ` +
      `which its ${m.scope === 'lesson' ? 'lesson' : 'stave'} does not notate`);
    console.error(`     wants one of : ${m.keys.join(', ')}  (${m.keys.map(k => KEY_TO_DRUM[k]).join('/')})`);
    console.error(`     stave has    : ${m.have || '(nothing)'}`);
    console.error(`     ${m.field}: "${m.clause.slice(0, 160)}"`);
  }
  for (const f of limbFindings) {
    console.error(`  ${f.slug}#${f.ex}  writes the ${f.drum} (${f.key}) into the HANDS voice`);
    console.error('     The renderer stems by voice, not by key, so it draws stem-up and reads as a hand.');
  }
  selfFail.forEach(s => console.error(`  ${s}`));
  console.error('');
  console.error('  A stave that draws a different instrument from the one its words name teaches the wrong');
  console.error('  reading AND plays the wrong sample. Decide per exercise by reading the tip and the lesson');
  console.error('  body — change the notation, or change the words — and verify it visually, because it');
  console.error('  moves noteheads to a different staff position.');
  process.exit(1);
}

console.log(`[check-named-voices] OK — ${mentionCount} instrument mentions across ${pairCount} ` +
  `exercise/voice and lesson/voice pairs; every unhedged one is on its stave.`);
console.log(`  ${exempted.length} known misses exempted (ratchet ${EXEMPTION_COUNT}, all still live), ` +
  `${KNOWN_CLEAN.length} named false positives clean by rule.`);
console.log(`  voice map read from player.js and re-measured through the renderer: ` +
  Object.keys(EXPECTED_MAP).map(k => `${KEY_TO_DRUM[k]}@${measured[k].toFixed(0)}`).join(' '));
process.exit(0);
