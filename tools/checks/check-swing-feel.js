#!/usr/bin/env node
// check-swing-feel.js — BL-128. The exercises that say they swing have to swing.
//
// Before this existed, `swing` appeared zero times in src/assets/js/player.js and
// pattern-math.js divided every beat in binary halves. 76 exercises across 27
// lessons print "swing 8ths", "swing 16ths" or "swung 16ths" in their meta, carry
// no tuplets, and put notes on exactly the subdivisions that instruction moves —
// 16 of the site's 21 jazz lessons — so jazz-ride-pattern, the lesson whose whole
// subject is the jazz ride, played a straight-eighths rock ride. Nothing on the
// page said so and no other gate can hear.
//
// This one hears. It loads a REAL built lesson page in a real browser, swaps the
// page's AudioContext for an OfflineAudioContext with a clock this file steps by
// hand, presses the REAL play button (with its real data-swing attribute), and
// then reads three different things off the same run:
//
//   1. SCHEDULED ONSETS, taken from the arguments to start() on every source node
//      the shipped player created. Not inferred from the spec — recorded off the
//      graph.
//   2. THE RENDERED SAMPLES, from startRendering() on that same context, so the
//      claim "the note moved" is checked against where sound actually begins and
//      not only against where the code said it would.
//   3. THE PLAYHEAD, by stepping the fake clock to each measured onset and
//      reading line.playhead's x1 out of the page's own SVG.
//
// WHY THE GAIN PRODUCT IS RECORDED. Voice identity cannot be read from a sample
// URL: footAcoustic and hatAcoustic both play /assets/audio/acoustic/hat_closed
// .wav and are separated only by a 0.55 gain node. So every source node is walked
// forward through the recorded connect() graph to destination and the product of
// the CONSTANT gain nodes on that path is kept (nodes whose AudioParam was ever
// automated are excluded — those are envelopes, and their .value is not a level).
// A full-level hand voice reads 1.000, a pedaled hat 0.550, a tap 0.500, a ghost
// 0.250. Iteration 79's spectral discriminator is not used and must not come back:
// it read ride at 0.1555 and hat at 0.1858, which overlap and settle nothing.
//
// THE MEASUREMENT THAT MATTERS HERE IS THE INTER-ONSET INTERVAL. Every case is
// run twice — as built, and with data-swing stripped — and the second is the
// straight baseline the first is measured against. A swung beat's two eighths must
// be unequal in the stated ratio; a straight exercise's must stay equal; an
// already-tupleted exercise must be identical in both runs.
//
// THE RATIO IS 2:1 AND THE SITE SETS IT. hi-hat-articulation#3, one of the 76:
// "Treat the swing 8ths as triplets with the middle note rested out." the-shuffle
// #0, which notates that as real tuplets: the short note "arrive[s] a third of a
// beat before the next click." Both put the off-beat at 2/3. RATIO_TOL below is
// 0.02 on a ratio of 2, which is generous against the 2.0000 every case measures
// and tight against the 3.000 a dotted-eighth reading and the 1.000 a straight
// one would give.
//
// THREE LABELS, THREE MEANINGS, one table (SWING_FEELS in player.js):
//   swing 8ths   the beat's second EIGHTH moves to 2/3 of the beat.
//   swung 16ths  each eighth's second SIXTEENTH moves to 2/3 of that eighth, and
//                the eighths themselves do not move at all. dilla84 asserts both
//                halves: a swung-16ths exercise whose eighth grid also moved would
//                pass a naive "the notes are uneven" test and fail this one.
//   shuffle      mapped to the swing-8ths division, population 0 — every shuffle
//                lesson writes "8th triplets" in its meta and notates real
//                tuplets, which is why they were already right. The mapping is
//                exercised by forcing data-swing onto the-shuffle#0 (case
//                shuffle80/force8), which must change nothing.
//
// ---------------------------------------------------------------------------
// THE HAZARD THIS FILE EXISTS FOR: DOUBLE-SWINGING WHAT ALREADY SWINGS.
// independence-chapin-method#4 prints "swing 8ths" AND notates 3:2 tuplets, and
// it is the one exercise in that lesson that sounded right before BL-128 — #0-#3
// print the same meta with no tuplets. jazz-modern-jazz has the same split (#4
// tupleted, #0 and #2 not); triplet-feel#3 is the third such spec but has no
// untupleted sibling. All four the-shuffle exercises are tupleted and were
// already correct. A continuous grid warp — the obvious implementation, and
// what a DAW groove template does — moves their 1/3 to 4/9 and their 2/3 to 7/9
// and breaks every one of them.
//
// So the cases named /force8 exist: they put data-swing="8" on a tupleted spec
// that the build refuses to mark, and require the TUPLETED onsets to come out
// identical to the unmarked run. That asserts the property rather than the policy
// — the player is told to swing something already swung and must decline. Three
// shapes are covered because they fail differently:
//   chapin75      3:2 triplets. Two independent things stop it (the tuplet-scale
//                 guard, and the projection's domain not containing p = 1/3 or
//                 2/3), so only the mutant that removes BOTH is caught here.
//   sextuplet70   the corpus's one 6:4 (hiphop-modern-production#1). Its FOURTH
//                 note lands on p = 0.5 by arithmetic, so the projection does NOT
//                 save it and only the tuplet-scale guard does. This is the case
//                 that catches `noscale` alone, and without it that guard could
//                 be deleted in silence.
//                 SAY WHAT IS AND IS NOT AT RISK: that exercise's meta reads
//                 "4/4 (half-time) - quarter = 70" and names no feel, so on the
//                 live site rule 1 stops it and it never reaches the guard at
//                 all. The guard is defense in depth and this case is the only
//                 thing that exercises it, via a forced attribute. Its first six
//                 notes are ordinary eighths and MUST move under that flag; that
//                 is asserted too, so the case cannot pass by the attribute
//                 quietly failing to apply.
//   shuffle80     the notated shuffle, as a whole-exercise control.
//
// ---------------------------------------------------------------------------
// MUTATION AUDIT, iteration 81: 11 constructed defects, 10 caught, 1 green and
// explained. Each is a source transform applied to /assets/js/player.js AS IT IS
// SERVED to the harness — the file in the tree is never touched. Re-run any with
// BL128_MUTATE=<name>; a mutation whose anchor string is not found aborts rather
// than reporting a vacuous pass.
//
// TWO OF THE ELEVEN WERE FOUND BY AN ADVERSARIAL PASS AFTER THIS FILE FIRST WENT
// GREEN, and both were holes rather than tightenings: `feetstraight` (the entire
// feet scheduling path was unmeasured) and `headslope` (the playhead's fixed
// points were asserted and its slope was not). The cases that close them, feet88
// and the dense speed scan, exist for no other reason.
//
//   nosw      swingFeelFrom always returns null (the pre-BL-128 player).
//             CAUGHT: 6 swung cases, every off-beat still on p = 0.500, pairs
//             read 0.5000:0.5000 = 1.0000.
//   ratio     SWING_LANDING 2/3 -> 0.75 (the dotted-eighth "hard" shuffle).
//             CAUGHT: pairs read 0.7500:0.2500 = 3.0000 against 2.
//   noscale   the `tupletScale !== 1` guard is deleted.
//             CAUGHT by sextuplet70/force8 ALONE — its 4th sextuplet note is at
//             p = 0.500 and moves 3.500 -> 3.667. Nothing else in the corpus can
//             see this one, which is the whole reason that case is here.
//   warp      the projection becomes a continuous piecewise-linear grid warp.
//             GREEN, and correctly so. This is the one worth reading twice: the
//             tuplet-scale guard returns before the map is ever consulted, so no
//             tupleted note reaches it, and NO untupleted note in the corpus sits
//             off the grid its own label names (measured: zero swing-8ths specs
//             have an onset off the eighth grid). So on today's content a warp
//             and a projection are the same function. The projection is still the
//             right shape — it is idempotent where a warp is not, and it survives
//             a spec with 16ths under a swing-8ths meta, which the corpus does not
//             have yet — but this file cannot tell them apart on its own and the
//             earlier draft of this note claiming it could was wrong.
//   warpnoscale  both of the above at once, i.e. the implementation someone
//             writes if they reach for a DAW groove template.
//             CAUGHT, and this is the double-swing the item exists to prevent:
//             chapin75 0.6667 -> 0.7778, shuffle80 0.6667 -> 0.7778,
//             sextuplet70 3.500 -> 3.667. Exactly the 2/3 -> 7/9 predicted.
//   stretch   `u` advances to the SWUNG position, so offsets accumulate.
//             CAUGHT by the onset positions, not by a duration assertion:
//             patternDuration comes from PatternMath and does not move, so the
//             visible damage is beat 2 arriving at 2.1667 and the loop seam
//             tearing. Onset 3 measures 2.16667 where the grid says 2.
//   nohead    the playhead stops un-swinging its clock.
//             CAUGHT: at ride90's beat 1.5 the cursor reads 0.4167 of the pattern
//             where the notehead is at 0.3750 — a sixth of a beat in four.
//   headtwice straightTime applied twice.
//             CAUGHT: same assertion, other sign, 0.3438 against 0.3750.
//   headslope straightTime keeps BOTH fixed points and loses the slope between
//             them (the second segment's (cell/2)/(cell-land) becomes 1).
//             Every onset still reads exact, so the fixed-point assertion above
//             is blind to it; mid-cell the cursor lags up to a sixth of a beat
//             and then snaps forward at every cell boundary, which a reader sees
//             immediately. CAUGHT only by the dense speed scan added for it.
//   feetstraight  schedulePattern hands `feel` to the hands voice and `null` to
//             the feet. Nine real onsets across six marked exercises stop
//             swinging — jazz-bop-vocabulary#3 (kick 1.5), jazz-post-bop#3 (6.5,
//             13.5), jazz-modern-jazz#2 (1.5), fusion-broken-time#0 (2.5), #2
//             (1.5), #3 (kick 1.5 and 2.5, pedal 3.5). Every case in this file
//             isolated a HANDS voice until feet88 was added, and voices140's
//             pedal is asserted UNMOVED because it sits on 2 and 4, so the whole
//             second scheduleVoice call was untested. CAUGHT by feet88 alone.
//   attr      the BUILT HTML is rewritten on the way out so every play button
//             without a data-swing gets one, i.e. .eleventy.js's tuplet and
//             no-feel vetoes both stop working.
//             CAUGHT: chapin75 reports a tupleted spec marked data-swing="8",
//             straight80 reports a feel on an exercise whose meta names none, and
//             dilla84's 16 is overwritten by 8.
//
// WHAT STAYS GREEN THAT SHOULD NOT — read this before trusting a pass.
//
//   a. THE RATIO IS ASSERTED FLAT, AND ONE PAGE SAYS IT SHOULD NOT BE.
//      jazz-ride-pattern's "Getting the Swing Right" reads "At MEDIUM tempos the
//      skip-note lands like the third note of a triplet" and then "The ratio also
//      breathes with tempo: swing tightens toward even 8ths as things get fast,
//      so trust your ear over any formula." So this file will fail a
//      tempo-dependent implementation even though that page asks for one, and it
//      is asserting 2:1 at jazz-up-tempo#2's 250 BPM where a real drummer plays
//      much shallower. The reason it is flat is in player.js's Swing block and
//      the short version is jazz-modern-jazz: #2 and #4 are the same lesson at
//      the same 130 BPM, one tupleted and one not, and only a flat ratio makes
//      them sound the same. Changing this means changing RATIO_TOL's centre here,
//      SWING_LANDING in player.js, and the lesson prose, in one move.
//
//   b. IT MEASURES SEVEN EXERCISES OUT OF SEVENTY-SIX. The other 69 are covered
//      only by the population assertion at the bottom, which counts data-swing
//      attributes in the built HTML and re-derives the same set from
//      lessonContent.js. That catches "the attribute stopped being emitted" and
//      "it is emitted on a tupleted spec". It does NOT catch a per-exercise
//      timing fault, because it never plays them. Adding one is cheap: a case is
//      four fields.
//
//   c. THE PLAYHEAD IS CHECKED IN TIME, NOT IN SPACE. The assertion is that at
//      the instant a note sounds, the cursor's progress through the pattern
//      equals that note's straight position over the pattern length. Whether the
//      x that progress maps to is really under the notehead is BL-143's question
//      — VexFlow spaces noteheads by duration and the cursor interpolates
//      linearly, so any bar mixing note values already drifts in SPACE. This file
//      deliberately does not chase that, and a swung bar is neither better nor
//      worse for it. If BL-143 is ever fixed by making progress non-linear in x,
//      the assertion here still holds and should be left alone.
//
//   d. A SWING META ON A SPEC OFF ITS OWN GRID SILENTLY GOES STRAIGHT.
//      .eleventy.js marks a spec only when every onset sits on the grid the LABEL
//      names — the eighth grid for "swing 8ths", the sixteenth for "swung 16ths".
//      The first draft of that test used the sixteenth grid for both, which would
//      have admitted a swing-8ths spec written in 16ths and shipped it wrong on
//      both axes: the 16th at 0.25 stays while the eighth at 0.5 moves to 0.667,
//      crushing the gap to 0.083 beats, and the cursor reads 0.1875 when the 0.25
//      note sounds. Nothing in the corpus exercises either version — measured,
//      ZERO swing-8ths onsets sit off the eighth grid, which is also what makes
//      the warp-versus-projection equivalence above true — so both the tightened
//      grid and the 32nd case are covered only by the unit assertions at the
//      bottom. The failure mode is a silent no-swing, not a scramble.
//
//   e. THE METRONOME MEASUREMENT IS SHALLOW. It presses the real dock on a real
//      page and reads the oscillator start times back, which proves the click is
//      evenly spaced while a swing-capable player sits on the same page. It runs
//      one tempo in one meter. Phase, meter changes and the visual row are
//      check-metro-phase.js's job and are not repeated here.
//
//   f. ONE CASE OF TEN CARRIES TWO VOICES. The rest isolate a single voice by
//      dropping the other keys, so their identity is guaranteed by construction
//      and their gain product is only corroboration. voices140 is the exception
//      and the reason the instrument is here: it keeps jazz-tony-williams#1's
//      hi-hat line and its pedaled hi-hat, which are the SAME buffer
//      (hat_closed.wav, 8453 frames on all eight onsets) separated only by a 0.55
//      gain node, and asserts the 6/2 split. A ghost or tap tier inside a swung
//      exercise is still unmeasured here; check-accent-dynamics.js owns those.
//
// Exits 0 on pass, 1 on fail, and 0 with a loud SKIP if Edge is not installed.
// A FAILURE COMES IN TWO SHAPES AND THEY MEAN DIFFERENT THINGS: an assertion
// failure prints "[check-swing-feel] FAIL:" and a list of measurements that
// disagree with the notation, and is a defect. An instrument failure prints
// "the harness produced no measurements", names the leg, and is an environment
// problem — see the flake-budget block below. Never chase the second as if it
// were the first.

const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SITE = path.join(ROOT, '_site');
const DEVDIR = path.join(SITE, 'dev');          // the one directory audit-site.js skips
const PM = require(path.join(ROOT, 'src/assets/js/pattern-math.js'));
const LC = require(path.join(ROOT, 'src/_data/lessonContent.js'));

// ---- flake budget ----------------------------------------------------------
// A clean run takes about 10 seconds and 16 consecutive solo runs plus 6 run
// alongside check-accent-dynamics all passed here, so the transient the
// orchestrator saw (roughly 1 in 4, inside a full-suite LOOP, with the output
// discarded) did not reproduce on this machine. It is treated as environmental
// and defended against rather than diagnosed, because the thing that actually
// costs a future agent a tick is not the red exit — it is a red exit with no
// diagnostic, which iteration 60 already lost a tick to on check-transport-
// reserve.
//
// Two defenses, and they are different in kind:
//   RETRY, so a transient does not become a failure. Each case gets a fresh
//   iframe up to CASE_TRIES times; the whole browser leg gets a fresh browser
//   and a fresh --user-data-dir up to BROWSER_TRIES times. The harness page is
//   rewritten before every browser attempt, because check-skip-targets.js:604
//   does a RECURSIVE fs.rmSync on the shared _site/dev and would otherwise be
//   able to delete this file out from under a retry.
//   CLASSIFY, so a failure that does survive says which it is. Anything that
//   means "could not measure" exits through bailHarness() with the words "the
//   harness produced no measurements" and the leg that failed; only a real
//   assertion prints "[check-swing-feel] FAIL:" and a list. check-transport-
//   reserve uses the same phrasing, so the class is greppable across the tree.
//
// The retry counts are PRINTED on success. A silent retry is the same disease
// as a silent failure: if that number stops reading 0, something has changed.
const TIMEOUT_MS = 120000;    // per browser attempt; a clean run is ~10s
const BROWSER_TRIES = 3;
const CASE_TRIES = 3;
const METRO_TRIES = 3;
const RATIO = 2;              // the swung pair, long : short
const RATIO_TOL = 0.02;
const ONSET_TOL = 1e-4;       // beats. Onsets are computed in float64 from the spec.
const UNEVEN_MIN = 0.15;      // |long-short| / (long+short); 2:1 gives 0.3333
const EVEN_TOL = 1e-4;        // a straight exercise's IOIs, in beats
// Post/pre energy ratio that counts as a note starting, and one that counts as
// nothing starting. The windows are wide because THE SAMPLES DO NOT PEAK AT ZERO:
// measured off the shipped wavs in 5ms steps, ride.wav reads 0.003 in its first
// 5ms and only reaches 1.000 at 10-15ms, kick.wav peaks at 15-30ms and snare.wav
// at 10-15ms. A 6ms attack window — the first thing tried here — sampled the
// lead-in and reported post/pre of 0.78 on notes that plainly sound. 28ms after
// against 32ms-to-8ms before clears every sample's transient and still fits
// inside the shortest gap any case produces (dilla84's swung 16th, 119ms).
//
// The bands are narrower than they look and the run prints both edges every time.
// Measured on clean code: the weakest real attack is 7.51 (dilla84/built onset 2)
// against the floor of 4, and the loudest vacated position is 1.36
// (hihat100/built at 2.160s) against the ceiling of 2. Under a mutation that
// makes two hits collide the "before" window catches the previous attack and a
// real onset can read 3.2-3.5, which is a true symptom but a confusing first
// line; read the onset-position failures underneath it before this one.
const ATTACK_POST = 0.028;
const ATTACK_PRE0 = 0.032, ATTACK_PRE1 = 0.008;
const ATTACK_MIN = 4;
const SILENCE_MAX = 2;
const HEAD_TOL = 0.004;       // playhead progress at an onset, as a fraction of the pattern
// The cursor's local speed, in straight-beats per swung-beat. straightTime is
// piecewise linear with exactly two slopes inside every cell — (cell/2)/(cell*2/3)
// = 0.75 through the long half and (cell/2)/(cell/3) = 1.5 through the short one —
// and both are independent of the cell, so the same pair holds for swing 8ths and
// swung 16ths. Samples that straddle a knot read somewhere between the two, which
// is why the assertion is a BAND plus a requirement that both ends be reached
// rather than a per-sample equality. A discontinuity registers as a slope far
// outside the band: the headslope mutant's boundary jump reads about 8.
const HEAD_SCAN_N = 240;
const HEAD_SLOPE_LO = 0.75, HEAD_SLOPE_HI = 1.5;
const HEAD_SLOPE_TOL = 0.06;
const METRO_TOL = 0.002;      // metronome click spacing, seconds

// The population floor. 76 buttons across 27 lessons carry a feel today; the
// filter is re-derived from lessonContent.js below, so this is only a guard
// against the feature being switched off wholesale.
const POP_FLOOR = 76;
const POP_LESSON_FLOOR = 27;

// Every case isolates ONE voice (`keep`) so the onsets it records cannot be
// confused with another line's, and uses the ACOUSTIC kit so each hit is exactly
// one buffer source — the electronic ride is three nodes at the same instant and
// would have to be deduped by time, which is the sort of step that hides a bug.
// `attr`: 'built' leaves data-swing as the build wrote it, 'none' strips it (the
// straight baseline), '8'/'16' force it on.
const CASES = [
  { id: 'ride90/built',       page: '/lessons/jazz-ride-pattern/',          btn: 1, keep: ['f/5/x2'], attr: 'built', slug: 'jazz-ride-pattern', ex: 1 },
  { id: 'ride90/none',        page: '/lessons/jazz-ride-pattern/',          btn: 1, keep: ['f/5/x2'], attr: 'none',  slug: 'jazz-ride-pattern', ex: 1 },
  { id: 'medium140/built',    page: '/lessons/jazz-medium-swing/',          btn: 0, keep: ['f/5/x2'], attr: 'built', slug: 'jazz-medium-swing', ex: 0 },
  { id: 'medium140/none',     page: '/lessons/jazz-medium-swing/',          btn: 0, keep: ['f/5/x2'], attr: 'none',  slug: 'jazz-medium-swing', ex: 0 },
  // Two voices in one render, and the pair the gain product exists for: the hat
  // line and the pedaled hi-hat both play hat_closed.wav, so nothing about the
  // buffer tells them apart. The 0.55 gain node does.
  { id: 'voices140/built',    page: '/lessons/jazz-tony-williams/',         btn: 1, keep: ['g/5/x2', 'd/4/x2'], attr: 'built', slug: 'jazz-tony-williams', ex: 1 },
  { id: 'voices140/none',     page: '/lessons/jazz-tony-williams/',         btn: 1, keep: ['g/5/x2', 'd/4/x2'], attr: 'none',  slug: 'jazz-tony-williams', ex: 1 },
  { id: 'hihat100/built',     page: '/lessons/hi-hat-articulation/',        btn: 3, keep: ['f/5/x2'], attr: 'built', slug: 'hi-hat-articulation', ex: 3 },
  { id: 'hihat100/none',      page: '/lessons/hi-hat-articulation/',        btn: 3, keep: ['f/5/x2'], attr: 'none',  slug: 'hi-hat-articulation', ex: 3 },
  { id: 'waltz120/built',     page: '/lessons/jazz-waltz/',                 btn: 0, keep: ['f/5/x2'], attr: 'built', slug: 'jazz-waltz', ex: 0 },
  { id: 'waltz120/none',      page: '/lessons/jazz-waltz/',                 btn: 0, keep: ['f/5/x2'], attr: 'none',  slug: 'jazz-waltz', ex: 0 },
  { id: 'dilla84/built',      page: '/lessons/hiphop-j-dilla/',             btn: 2, keep: ['g/5/x2'], attr: 'built', slug: 'hiphop-j-dilla', ex: 2 },
  { id: 'dilla84/none',       page: '/lessons/hiphop-j-dilla/',             btn: 2, keep: ['g/5/x2'], attr: 'none',  slug: 'hiphop-j-dilla', ex: 2 },
  // THE FEET, which every other case drops. schedulePattern calls scheduleVoice
  // twice and until this case existed the second call was untested: handing
  // `null` instead of `feel` to the feet line passed every assertion in this file
  // while nine real onsets across six marked exercises silently went straight
  // (jazz-bop-vocabulary#3, jazz-post-bop#3, jazz-modern-jazz#2,
  // fusion-broken-time#0/#2/#3). voices140's pedal is asserted UNMOVED because it
  // sits on 2 and 4, so it could not see this. fusion-broken-time#3 has three
  // off-beat foot onsets (1.5, 2.5, 3.5) across BOTH foot voices — kick and
  // pedaled hi-hat — and its hands are dropped entirely, so nothing but the feet
  // path can produce these onsets.
  { id: 'feet88/built',       page: '/lessons/fusion-broken-time/',         btn: 3, keep: ['f/4', 'd/4/x2'], attr: 'built', slug: 'fusion-broken-time', ex: 3 },
  { id: 'feet88/none',        page: '/lessons/fusion-broken-time/',         btn: 3, keep: ['f/4', 'd/4/x2'], attr: 'none',  slug: 'fusion-broken-time', ex: 3 },
  { id: 'chapin75/built',     page: '/lessons/independence-chapin-method/', btn: 4, keep: ['f/5/x2'], attr: 'built', slug: 'independence-chapin-method', ex: 4 },
  { id: 'chapin75/force8',    page: '/lessons/independence-chapin-method/', btn: 4, keep: ['f/5/x2'], attr: '8',     slug: 'independence-chapin-method', ex: 4 },
  { id: 'sextuplet70/built',  page: '/lessons/hiphop-modern-production/',   btn: 1, keep: ['g/5/x2'], attr: 'built', slug: 'hiphop-modern-production', ex: 1 },
  { id: 'sextuplet70/force8', page: '/lessons/hiphop-modern-production/',   btn: 1, keep: ['g/5/x2'], attr: '8',     slug: 'hiphop-modern-production', ex: 1 },
  { id: 'shuffle80/built',    page: '/lessons/the-shuffle/',                btn: 0, keep: ['g/5/x2'], attr: 'built', slug: 'the-shuffle', ex: 0 },
  { id: 'shuffle80/force8',   page: '/lessons/the-shuffle/',                btn: 0, keep: ['g/5/x2'], attr: '8',     slug: 'the-shuffle', ex: 0 },
  { id: 'straight80/built',   page: '/lessons/first-beat-kicks/',           btn: 0, keep: ['g/5/x2'], attr: 'built', slug: 'first-beat-kicks', ex: 0 },
];

// [as built, told to swing, why]. The comparison is over the TUPLETED notes only,
// which is the whole spec for chapin75 and shuffle80 but six notes of twelve for
// sextuplet70 — that one's first six eighths are ordinary and SHOULD move once the
// flag is forced on. Requiring the whole exercise to freeze there would have been
// an assertion about the case, not about the guard.
const IDENTICAL_PAIRS = [
  ['chapin75/built', 'chapin75/force8', 'a 3:2-tupleted spec told to swing must not move'],
  ['sextuplet70/built', 'sextuplet70/force8', 'a 6:4 sextuplet told to swing must not move'],
  ['shuffle80/built', 'shuffle80/force8', 'a notated shuffle told to swing must not move'],
];
// id -> baseline id, for the exercises that DO swing.
const SWUNG_PAIRS = [
  ['ride90/built', 'ride90/none', 8],
  ['medium140/built', 'medium140/none', 8],
  ['voices140/built', 'voices140/none', 8],
  ['hihat100/built', 'hihat100/none', 8],
  ['waltz120/built', 'waltz120/none', 8],
  ['dilla84/built', 'dilla84/none', 16],
  ['feet88/built', 'feet88/none', 8],
];

// ---- mutations, applied to player.js AS SERVED ------------------------------
const MUTATIONS = {
  nosw: [['    return SWING_FEELS[Number(raw)] || null;', '    return null;']],
  ratio: [['  const SWING_LANDING = 2 / 3;', '  const SWING_LANDING = 0.75;']],
  warp: [[
    '    return Math.abs(p - cell / 2) < SWING_EPS ? base + cell * SWING_LANDING : u;',
    '    return p < cell / 2 ? base + p * 2 * SWING_LANDING\n' +
    '      : base + cell * SWING_LANDING + (p - cell / 2) * 2 * (1 - SWING_LANDING);'
  ]],
  noscale: [['    if (!feel || tupletScale !== 1) return u;', '    if (!feel) return u;']],
  warpnoscale: [
    ['    if (!feel || tupletScale !== 1) return u;', '    if (!feel) return u;'],
    [
      '    return Math.abs(p - cell / 2) < SWING_EPS ? base + cell * SWING_LANDING : u;',
      '    return p < cell / 2 ? base + p * 2 * SWING_LANDING\n' +
      '      : base + cell * SWING_LANDING + (p - cell / 2) * 2 * (1 - SWING_LANDING);'
    ]
  ],
  stretch: [['      u += len;', '      u = swungOnset(u, feel, scale[i]) + len;']],
  // The hands swing and the feet do not — one argument, one word.
  feetstraight: [[
    "    scheduleVoice(spec.feet  || [], c, kit, out, startAt, bpm, spec, 'feet', marked, feel);",
    "    scheduleVoice(spec.feet  || [], c, kit, out, startAt, bpm, spec, 'feet', marked, null);"
  ]],
  // straightTime keeps both of its fixed points and loses the SLOPE between them:
  // every onset still reads exact, and the cursor lags up to a sixth of a beat
  // mid-cell then snaps forward at each cell boundary.
  headslope: [[
    '      : base + cell / 2 + (p - land) * (cell / 2) / (cell - land);',
    '      : base + cell / 2 + (p - land);'
  ]],
  nohead: [[
    '        ? straightTime(phase / session.secsPerBeat, session.feel) * session.secsPerBeat',
    '        ? phase'
  ]],
  headtwice: [[
    '        ? straightTime(phase / session.secsPerBeat, session.feel) * session.secsPerBeat',
    '        ? straightTime(straightTime(phase / session.secsPerBeat, session.feel), session.feel) * session.secsPerBeat'
  ]],
  // Not a player change: this one rewrites the BUILT HTML as it is served, giving
  // data-swing="8" to every play button that does not already carry one. It is
  // what a broken veto in .eleventy.js would ship.
  attr: [],
};
const MUTATE = process.env.BL128_MUTATE || '';
if (MUTATE && !(MUTATE in MUTATIONS)) {
  console.error('[check-swing-feel] unknown BL128_MUTATE=' + MUTATE + '; known: ' + Object.keys(MUTATIONS).join(', '));
  process.exit(2);
}

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
  console.error('[check-swing-feel] FAIL — _site is missing. Run `npm run build` first.');
  process.exit(1);
}
const browser = findBrowser();
if (!browser) {
  console.warn('[check-swing-feel] SKIP — no Edge/Chrome binary found; audio cannot be measured here.');
  process.exit(0);
}

// ---- source-side expectations ----------------------------------------------
// The straight grid every case is measured against, computed by the SHARED
// PatternMath the player uses. Onsets are in quarter-note units from the start of
// the pattern; `scale` is the note's tuplet factor.
function straightOnsets(spec, keep) {
  const out = [];
  for (const voice of ['hands', 'feet']) {
    const arr = spec[voice] || [];
    const scale = PM.tupletScales(spec, voice, arr.length);
    let u = 0;
    for (let i = 0; i < arr.length; i++) {
      const ticks = PM.durationTicks(arr[i]);
      const len = (ticks === null ? 1 : ticks) * scale[i];
      const keys = (arr[i].keys || []).filter(k => keep.indexOf(k) !== -1);
      if (!arr[i].rest && keys.length) out.push({ u: u, scale: scale[i], voice: voice, i: i });
      u += len;
    }
  }
  return out.sort((a, b) => a.u - b.u);
}

// ---- harness ----------------------------------------------------------------
// One real built page per case, in an iframe. Two globals are replaced on the
// iframe's window after load and before the first press, and player.js resolves
// both at CALL time so no source change is needed:
//   * AudioContext -> an OfflineAudioContext whose currentTime this file drives.
//     getCtx() builds it on the first click, so the swap has to land before that
//     and nowhere else; every measurement below comes out of the real graph.
//   * requestAnimationFrame -> a queue drained by hand, because the playhead has
//     to be sampled at chosen instants rather than at whatever the compositor
//     decides, and headless frames are scarce.
const HARNESS = `<!doctype html><meta charset="utf-8"><body style="margin:0"><div id="o">pending</div>
<script>
window.__CASES = __CASES__;
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, tries, gap) {
  for (let i = 0; i < (tries || 2000); i++) { if (fn()) return true; await sleep(gap || 5); }
  return false;
}

// Record start() times, the connect() graph, and which AudioParams were
// automated, for everything the page builds after this runs.
function instrument(cw, rec) {
  const edges = new Map();
  const automated = new WeakSet();
  const AP = cw.AudioParam.prototype;
  ['setValueAtTime', 'linearRampToValueAtTime', 'exponentialRampToValueAtTime',
   'setTargetAtTime', 'setValueCurveAtTime'].forEach(function (m) {
    const orig = AP[m];
    if (!orig) return;
    AP[m] = function () { automated.add(this); return orig.apply(this, arguments); };
  });
  const origConnect = cw.AudioNode.prototype.connect;
  cw.AudioNode.prototype.connect = function (dst) {
    if (dst instanceof cw.AudioNode) {
      let a = edges.get(this); if (!a) { a = []; edges.set(this, a); }
      a.push(dst);
    }
    return origConnect.apply(this, arguments);
  };
  const OAC = cw.OfflineAudioContext;
  const SR = 44100;
  cw.AudioContext = function () {
    const oc = new OAC(2, Math.ceil(rec.renderSecs * SR), SR);
    oc.resume = function () { return Promise.resolve(); };
    Object.defineProperty(oc, 'currentTime', { get: function () { return rec.now; }, configurable: true });
    function tag(node, kind) {
      const orig = node.start;
      node.start = function (t) {
        rec.starts.push({
          node: node, kind: kind, t: (t === undefined ? rec.now : t),
          desc: kind === 'osc' ? (node.type + '@' + Math.round(node.frequency.value))
                               : ('buf:' + (node.buffer ? node.buffer.length : 0))
        });
        return orig.apply(node, arguments);
      };
      return node;
    }
    const cbs = oc.createBufferSource.bind(oc), cos = oc.createOscillator.bind(oc);
    oc.createBufferSource = function () { return tag(cbs(), 'buf'); };
    oc.createOscillator = function () { return tag(cos(), 'osc'); };
    rec.ctx = oc;
    rec.edges = edges;
    rec.automated = automated;
    return oc;
  };
  cw.webkitAudioContext = cw.AudioContext;
}

// Product of the gain nodes between a source and destination. Two numbers: every
// gain node on the path, and only the ones whose param was never automated (the
// second is the level, the first includes envelope nodes whose .value is not one).
function gainPath(cw, rec, node) {
  const dest = rec.ctx.destination;
  const seen = new Set();
  let q = [{ n: node, g: 1, c: 1, chain: [] }];
  for (let depth = 0; depth < 24 && q.length; depth++) {
    const next = [];
    for (const cur of q) {
      if (cur.n === dest) return { gain: cur.g, level: cur.c, chain: cur.chain.join('>') };
      if (seen.has(cur.n)) continue;
      seen.add(cur.n);
      for (const d of (rec.edges.get(cur.n) || [])) {
        let g = cur.g, c = cur.c, lbl = 'node';
        if (d instanceof cw.GainNode) {
          const v = d.gain.value;
          g = g * v;
          if (!rec.automated.has(d.gain)) { c = c * v; lbl = 'G' + v.toFixed(3); }
          else lbl = 'env';
        } else if (d === dest) { lbl = 'dest'; }
        next.push({ n: d, g: g, c: c, chain: cur.chain.concat(lbl) });
      }
    }
    q = next;
  }
  return { gain: null, level: null, chain: 'UNREACHED' };
}

// Thrown for anything that means "could not measure". It is caught by the retry
// wrapper and, if the retries run out, travels to Node as harnessFail so the exit
// message can say so instead of looking like an assertion.
function Unmeasurable(leg, why) { this.leg = leg; this.why = why; this.unmeasurable = true; }

async function runCaseOnce(kase) {
  const f = document.createElement('iframe');
  f.style.cssText = 'position:absolute;left:-9000px;top:0;width:1280px;height:900px;border:0';
  f.src = kase.page;
  document.body.appendChild(f);
  let loaded = false;
  await new Promise(function (res) { f.onload = function () { loaded = true; res(); }; f.onerror = res; setTimeout(res, 30000); });
  if (!loaded) { f.remove(); throw new Unmeasurable('page', kase.id + ': ' + kase.page + ' never loaded'); }
  const cw = f.contentWindow, d = f.contentDocument;
  // Wait for READINESS rather than a fixed delay. The fixed 80ms this replaced is
  // the obvious contention flake: under a second headless browser the page's own
  // scripts and VexFlow's SVG layout can miss it, and then getMusicBounds returns
  // null, the playhead never exists, and the check reports "playhead not
  // measurable" — which reads exactly like a real defect.
  const ready = await waitFor(function () {
    if (!cw.PatternMath || !d.querySelectorAll('[data-exercise-play]').length) return false;
    const head = d.querySelector('.notation svg g.vf-stavenote g.vf-notehead');
    if (!head) return false;
    try { return head.getBBox().width > 0; } catch (e) { return false; }
  }, 600, 25);
  if (!ready) { f.remove(); throw new Unmeasurable('page', kase.id + ': page never became measurable (PatternMath, a play button and a laid-out notehead) within 15s'); }

  const rec = { now: 0, renderSecs: 6, starts: [], ctx: null, edges: null, automated: null };
  instrument(cw, rec);
  const rafQ = [];
  cw.requestAnimationFrame = function (fn) { rafQ.push(fn); return rafQ.length; };
  cw.cancelAnimationFrame = function () {};

  const buttons = d.querySelectorAll('[data-exercise-play]');
  const btn = buttons[kase.btn];
  if (!btn) { f.remove(); throw new Unmeasurable('page', kase.id + ': no play button at index ' + kase.btn + ' (page has ' + buttons.length + ')'); }
  const builtAttr = btn.getAttribute('data-swing');
  if (kase.attr === 'none') btn.removeAttribute('data-swing');
  else if (kase.attr !== 'built') btn.setAttribute('data-swing', kase.attr);

  // Isolate one voice. data-swing is untouched by this; only keys are dropped.
  const spec = JSON.parse(btn.getAttribute('data-spec'));
  for (const v of ['hands', 'feet']) {
    (spec[v] || []).forEach(function (n) {
      if (!n.keys) return;
      n.keys = n.keys.filter(function (k) { return kase.keep.indexOf(k) !== -1; });
      if (!n.keys.length) { n.rest = true; delete n.keys; }
    });
  }
  btn.setAttribute('data-spec', JSON.stringify(spec));

  const patDur = cw.PatternMath.patternDurationSecs(spec);
  rec.renderSecs = patDur + 1.2;

  const sel = btn.closest('.exercise').querySelector('[data-exercise-kit]');
  if (sel) sel.value = 'acoustic';
  btn.click();
  if (!await waitFor(function () { return btn._session; }, 4000, 5)) {
    f.remove();
    throw new Unmeasurable('audio', kase.id + ': no PlaybackSession 20s after the click (the acoustic kit decodes before it schedules)');
  }
  const s = btn._session;
  clearInterval(s.timer); s.timer = null;         // currentTime is frozen: one pattern, no top-up

  const onsets = rec.starts.map(function (r) {
    const gp = gainPath(cw, rec, r.node);
    return { t: r.t, kind: r.kind, desc: r.desc, gain: gp.gain, level: gp.level, chain: gp.chain };
  }).sort(function (a, b) { return a.t - b.t; });

  // A SHORT ONSET LIST IS AN INSTRUMENT FAILURE, NOT A DEFECT, and the difference
  // matters. playAcousticSample returns silently when its buffer is missing, so a
  // dropped fetch or a failed decode produces FEWER source nodes and nothing else
  // — no error, no console line. Every count in this file is fixed by the spec and
  // no swing bug can change one, so a mismatch here is the harness, and it is
  // retried rather than reported. The counts still travel in the message, so a
  // mismatch that survives all the retries is not hidden.
  if (onsets.length !== kase.expect) {
    f.remove();
    throw new Unmeasurable('audio', kase.id + ': scheduled ' + onsets.length + ' onsets, the spec has ' +
      kase.expect + ' on the kept voice — a sample almost certainly failed to fetch or decode');
  }
  if (!s.line || !s.bounds) {
    f.remove();
    throw new Unmeasurable('playhead', kase.id + ': no playhead (line=' + !!s.line + ' bounds=' + !!s.bounds +
      ') — getMusicBounds needs at least two laid-out noteheads');
  }

  // ---- playhead: step the clock and read the cursor out of the page's own SVG ----
  const head = [];
  const scan = [];
  let headErr = null;
  const span = s.bounds.endX - s.bounds.startX;
  if (!(span > 0)) { f.remove(); throw new Unmeasurable('playhead', kase.id + ': the stave has no horizontal span'); }
  const sample = function (t) {
    rec.now = t;
    const q = rafQ.splice(0, rafQ.length);
    for (const fn of q) { try { fn(rec.now * 1000); } catch (e) { headErr = String(e); } }
    const x = parseFloat(s.line.getAttribute('x1'));
    return isFinite(x) ? (x - s.bounds.startX) / span : null;
  };
  // at each onset: the fixed points
  for (const o of onsets) head.push({ t: o.t, progress: sample(o.t) });
  // and a dense sweep BETWEEN them, because the fixed points alone do not pin
  // the map: a mutant that keeps 0 -> 0 and cell/2 -> cell*2/3 but flattens the
  // slope in between reads exact at every note and is a sixth of a beat wrong
  // halfway through the cell.
  const N = __HEAD_SCAN_N__;
  for (let k = 0; k <= N; k++) {
    const t = s.audioStart + (k / N) * s.patternDuration * 0.97;
    scan.push({ t: t, progress: sample(t) });
  }
  if (headErr) { f.remove(); throw new Unmeasurable('playhead', kase.id + ': the playhead frame threw — ' + headErr); }
  if (scan.some(function (p) { return p.progress === null; })) {
    f.remove();
    throw new Unmeasurable('playhead', kase.id + ': the cursor read back a non-numeric x during the sweep');
  }
  rec.now = 0;

  // ---- render, and confirm sound really starts where start() said ----
  let buf;
  try { buf = await rec.ctx.startRendering(); }
  catch (e) { f.remove(); throw new Unmeasurable('render', kase.id + ': startRendering threw — ' + e); }
  const ch = buf.getChannelData(0), sr = buf.sampleRate;
  function win(a, b) {
    let p = 0;
    const i0 = Math.max(0, Math.floor(a * sr)), i1 = Math.min(ch.length, Math.ceil(b * sr));
    for (let i = i0; i < i1; i++) { const x = Math.abs(ch[i]); if (x > p) p = x; }
    return p;
  }
  const AP0 = __ATTACK_POST__, AR0 = __ATTACK_PRE0__, AR1 = __ATTACK_PRE1__;
  function attack(t) {
    if (t < AR0 + 0.004 || t > rec.renderSecs - AP0 - 0.004) return null;
    return win(t, t + AP0) / (win(t - AR0, t - AR1) + 1e-9);
  }
  let peak = 0;
  for (let i = 0; i < ch.length; i++) { const x = Math.abs(ch[i]); if (x > peak) peak = x; }
  // Silence is the other face of an undecoded sample: the nodes were created and
  // started, so the count above was right, and nothing came out of them.
  if (!(peak > 0.01)) { f.remove(); throw new Unmeasurable('render', kase.id + ': the render is silent (peak ' + peak + ')'); }

  f.remove();
  return {
    id: kase.id, builtAttr: builtAttr, feel: s.feel ? s.feel.cell : null,
    audioStart: s.audioStart, bpm: spec.bpm, patternDuration: s.patternDuration,
    patternBeats: cw.PatternMath.patternBeats(spec),
    onsets: onsets, head: head, scan: scan, headErr: headErr, peak: peak,
    attacks: onsets.map(function (o) { return attack(o.t); }),
    // energy at the position each onset WOULD have had on the straight grid,
    // supplied by the driver below as absolute seconds.
    probes: (kase.probes || []).map(function (t) { return { t: t, ratio: attack(t) }; })
  };
}

// A case gets CASE_TRIES fresh iframes before its trouble is called real. Only
// Unmeasurable is retried; a genuine throw is a bug in this file and propagates.
async function runCase(kase) {
  let last = null;
  for (let attempt = 1; attempt <= __CASE_TRIES__; attempt++) {
    try {
      const r = await runCaseOnce(kase);
      r.attempts = attempt;
      return r;
    } catch (e) {
      if (!e || !e.unmeasurable) throw e;
      last = e;
      await sleep(250 * attempt);
    }
  }
  last.attempts = __CASE_TRIES__;
  throw last;
}

// ---- the metronome must not swing ------------------------------------------
// The real dock on a real page, pressed for real, with a recording oscillator in
// place of the audio one. The clock is stepped by hand and the scheduler's own
// 200ms interval is left to fire on real time between steps.
async function runMetronomeOnce(page, bpm) {
  const f = document.createElement('iframe');
  f.style.cssText = 'position:absolute;left:-9000px;top:0;width:1280px;height:900px;border:0';
  f.src = page;
  document.body.appendChild(f);
  let loaded = false;
  await new Promise(function (res) { f.onload = function () { loaded = true; res(); }; f.onerror = res; setTimeout(res, 30000); });
  if (!loaded) { f.remove(); throw new Unmeasurable('metronome', page + ' never loaded'); }
  const cw = f.contentWindow, d = f.contentDocument;
  if (!await waitFor(function () { return d.getElementById('metronome-toggle'); }, 600, 25)) {
    f.remove();
    throw new Unmeasurable('metronome', 'the dock never appeared on ' + page);
  }
  let T = 0;
  const clicks = [];
  function FakeParam() {}
  FakeParam.prototype.setValueAtTime = function () { return this; };
  FakeParam.prototype.exponentialRampToValueAtTime = function () { return this; };
  FakeParam.prototype.linearRampToValueAtTime = function () { return this; };
  FakeParam.prototype.cancelScheduledValues = function () { return this; };
  function FakeCtx() {
    this.state = 'running';
    this.destination = { __dest: true };
    Object.defineProperty(this, 'currentTime', { get: function () { return T; } });
  }
  FakeCtx.prototype.resume = function () { return Promise.resolve(); };
  FakeCtx.prototype.createGain = function () {
    return { gain: new FakeParam(), connect: function (x) { return x; }, disconnect: function () {} };
  };
  FakeCtx.prototype.createOscillator = function () {
    const v = { type: '', frequency: { value: 0 } };
    v.connect = function (x) { return x; };
    v.start = function (t) { clicks.push({ t: +t.toFixed(6), freq: v.frequency.value }); };
    v.stop = function () {};
    return v;
  };
  cw.AudioContext = FakeCtx; cw.webkitAudioContext = FakeCtx;
  cw.requestAnimationFrame = function (fn) { return cw.setTimeout(function () { fn(T * 1000); }, 16); };
  cw.cancelAnimationFrame = function (id) { cw.clearTimeout(id); };

  const root = d.getElementById('site-metronome');
  const pill = d.getElementById('metronome-pill');
  const toggle = d.getElementById('metronome-toggle');
  const bpmIn = d.getElementById('metronome-bpm');
  if (!root || !pill || !toggle || !bpmIn) {
    f.remove();
    throw new Unmeasurable('metronome', 'dock markup missing (root/pill/toggle/bpm): ' + [!!root, !!pill, !!toggle, !!bpmIn].join(','));
  }
  if (root.classList.contains('is-collapsed')) pill.click();
  bpmIn.value = String(bpm);
  bpmIn.dispatchEvent(new cw.Event('change', { bubbles: true }));
  toggle.click();
  // The clock is stepped by hand; metronome.js's own 200ms setInterval fires on
  // REAL time in between, so this loop has to leave real milliseconds on the
  // table. It keeps stepping until enough clicks have landed rather than for a
  // fixed count, because under a second headless browser the interval is exactly
  // the thing that gets starved — and a short click list is an unmeasured
  // metronome, not an uneven one.
  for (let k = 0; k < 60 && clicks.length < 8; k++) { T += 0.15; await sleep(60); }
  toggle.click();
  f.remove();
  if (clicks.length < 4) {
    throw new Unmeasurable('metronome', 'only ' + clicks.length + ' clicks in ' + T.toFixed(2) +
      's of stepped time; at least 4 are needed to measure spacing');
  }
  return { bpm: bpm, clicks: clicks.sort(function (a, b) { return a.t - b.t; }) };
}

async function runMetronome(page, bpm) {
  let last = null;
  for (let attempt = 1; attempt <= __METRO_TRIES__; attempt++) {
    try {
      const r = await runMetronomeOnce(page, bpm);
      r.attempts = attempt;
      return r;
    } catch (e) {
      if (!e || !e.unmeasurable) throw e;
      last = e;
      await sleep(250 * attempt);
    }
  }
  last.attempts = __METRO_TRIES__;
  throw last;
}

(async function () {
  const out = { cases: [], metro: null, error: null, harnessFail: null };
  try {
    for (const kase of window.__CASES) out.cases.push(await runCase(kase));
    out.metro = await runMetronome(window.__CASES[0].page, 120);
  } catch (e) {
    // Two channels on purpose. harnessFail means the instrument could not read;
    // error means this file has a bug. Node prints them differently and only the
    // first is retried. (No backticks in here: this whole block is a template
    // literal on the Node side and one backtick ends it 400 lines early.)
    if (e && e.unmeasurable) out.harnessFail = { leg: e.leg, why: e.why, attempts: e.attempts || 1 };
    else out.error = String((e && e.stack) || e);
  }
  const json = JSON.stringify(out);
  document.getElementById('o').textContent = json.slice(0, 200);
  try { await fetch('/__result', { method: 'POST', body: json }); } catch (e) {}
})();
</script></body>`;

// Which subdivision a meta names. Kept here because both the probe positions and
// the population assertion need it, and because it is the ONE place this file
// re-derives .eleventy.js's rule rather than trusting it.
function metaLevel(meta) {
  const s = String(meta || '').toLowerCase();
  if (/(?:swing|swung)\s*16(?:th|ths)?\b/.test(s)) return 16;
  if (/(?:swing|swung)\s*8(?:th|ths)?\b/.test(s)) return 8;
  if (/\bshuffle\b/.test(s)) return 8;
  return 0;
}

// The straight-grid probe times each case needs, in absolute seconds: the
// positions its notes VACATE, where sound must NOT start in the shipped render
// and MUST start in the straight baseline. The cell is the label's, not the
// eighth's — the first draft of this used `u % 1 === 0.5` for every case and so
// probed dilla84 at positions swung 16ths deliberately leave alone, which is a
// wrong probe reading as a real failure.
const LOOKAHEAD = 0.06;   // PlaybackSession.start()'s
for (const kase of CASES) {
  const ex = LC[kase.slug].exercises[kase.ex];
  const level = metaLevel(ex.meta);
  const cell = level === 16 ? 0.5 : 1;
  const spb = 60 / (ex.bpm || 80);
  kase.level = level;
  kase.probes = (level && !(ex.tuplets || []).length)
    ? straightOnsets(ex, kase.keep)
      .filter(o => o.scale === 1 && Math.abs((o.u % cell) - cell / 2) < 1e-9)
      .map(o => LOOKAHEAD + o.u * spb)
    : [];
  // How many source nodes the kept voice must produce. The harness treats a
  // shortfall as an instrument failure and retries; see runCaseOnce.
  kase.expect = straightOnsets(ex, kase.keep).length;
}

// ---- write the harness, serve _site (mutating player.js on the way out) -----

const PAGE_NAME = '__swing-feel.html';
const createdDevDir = !fs.existsSync(DEVDIR);
// Rewritten before EVERY browser attempt, not once. check-skip-targets.js:604
// does a recursive fs.rmSync on this shared directory when it did not find it
// pre-existing, so a concurrent or interleaved run can take this file away; a
// retry that reused a deleted page would just 404 and time out again.
// split/join, not String.replace: a string pattern replaces only the FIRST
// occurrence, and __CASE_TRIES__ appears twice. That left the retry path calling
// an undefined identifier — a bug that could ONLY ever fire once the environment
// had already flaked, which is the worst possible place for one. Found by
// deleting a built page and watching this check try to recover.
function writeHarness() {
  const subs = {
    __CASES__: JSON.stringify(CASES),
    __HEAD_SCAN_N__: String(HEAD_SCAN_N),
    __CASE_TRIES__: String(CASE_TRIES),
    __METRO_TRIES__: String(METRO_TRIES),
    __ATTACK_POST__: String(ATTACK_POST),
    __ATTACK_PRE0__: String(ATTACK_PRE0),
    __ATTACK_PRE1__: String(ATTACK_PRE1),
  };
  let page = HARNESS;
  for (const [k, v] of Object.entries(subs)) page = page.split(k).join(v);
  const left = page.match(/__[A-Z0-9_]+__/g);
  if (left) bail('the harness still has unsubstituted placeholders: ' + [...new Set(left)].join(', '));
  fs.mkdirSync(DEVDIR, { recursive: true });
  fs.writeFileSync(path.join(DEVDIR, PAGE_NAME), page, 'utf8');
}

function cleanup() {
  try { fs.unlinkSync(path.join(DEVDIR, PAGE_NAME)); } catch (e) {}
  if (createdDevDir) { try { fs.rmdirSync(DEVDIR); } catch (e) {} }
}
function bail(msg) {
  cleanup();
  console.error('[check-swing-feel] FAIL — ' + msg);
  process.exit(1);
}
// THE INSTRUMENT FAILED, THE SUBJECT DID NOT. Deliberately worded so it can never
// be mistaken for an assertion failure, and deliberately sharing "the harness
// produced no measurements" with check-transport-reserve so the whole class is
// greppable across the tree. A real assertion failure prints
// "[check-swing-feel] FAIL:" followed by a list; this prints neither.
function bailHarness(leg, detail, attempts) {
  cleanup();
  console.error(`[check-swing-feel] FAIL — the harness produced no measurements after ${attempts} browser attempt(s).`);
  console.error(`  leg: ${leg}`);
  console.error(`  ${detail}`);
  console.error('');
  console.error('  THIS IS AN INSTRUMENT FAILURE, NOT AN ASSERTION FAILURE. Nothing above says the');
  console.error('  player got the swing wrong — it says this check could not measure it. Every');
  console.error('  case already retried ' + CASE_TRIES + 'x in a fresh iframe and the browser ' + BROWSER_TRIES + 'x with a fresh');
  console.error('  profile. Look at the environment first: is _site built and intact (another');
  console.error('  check doing a recursive rmSync on _site/dev can delete this harness), is Edge');
  console.error('  installed and able to launch, is the machine loaded enough to starve a 200ms');
  console.error('  setInterval? Run it alone before believing it.');
  process.exit(1);
}

let mutationApplied = MUTATE === '';
function serveJs(src, file) {
  if (!MUTATE || !file.endsWith('player.js')) return src;
  for (const [from, to] of MUTATIONS[MUTATE]) {
    if (src.indexOf(from) === -1) {
      bail(`mutation "${MUTATE}" anchor not found in player.js: ${JSON.stringify(from.slice(0, 60))}. ` +
        'A mutation that does not apply reports a vacuous pass; fix the anchor.');
    }
    src = src.split(from).join(to);
    mutationApplied = true;
  }
  return src;
}
function serveHtml(src) {
  if (MUTATE !== 'attr') return src;
  const out = src.replace(/<button class="play-btn"((?:(?!data-swing)[^>])*?)data-spec=/g,
    '<button class="play-btn"$1data-swing="8" data-spec=');
  if (out !== src) mutationApplied = true;
  return out;
}

const TYPES = { '.html': 'text/html;charset=utf-8', '.css': 'text/css;charset=utf-8',
  '.js': 'text/javascript;charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.wav': 'audio/wav', '.json': 'application/json', '.xml': 'application/xml' };

// One request handler, a new http.Server per browser attempt.
let deliver = null;
const handler = (req, res) => {
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
    const ext = path.extname(f);
    const type = TYPES[ext] || 'application/octet-stream';
    let payload = buf;
    if (ext === '.js') payload = Buffer.from(serveJs(buf.toString('utf8'), f), 'utf8');
    else if (ext === '.html' && !f.endsWith(PAGE_NAME)) payload = Buffer.from(serveHtml(buf.toString('utf8')), 'utf8');
    res.writeHead(200, { 'Content-Type': type });
    res.end(payload);
  });
};

// ---- static assertions, which need no browser -------------------------------
const fails = [];
const notes = [];

// The population, re-derived here rather than trusted from .eleventy.js.
const expected = [];      // { slug, i, level }
const vetoed = [];
for (const slug of Object.keys(LC)) {
  ((LC[slug] || {}).exercises || []).forEach((ex, i) => {
    const level = metaLevel(ex.meta);
    if (!level || !ex.bpm) return;
    if ((ex.tuplets || []).length) { vetoed.push(`${slug}#${i} (tuplets)`); return; }
    if (Number(String(ex.timeSignature || '').split('/')[1]) !== 4) { vetoed.push(`${slug}#${i} (meter)`); return; }
    expected.push({ slug, i, level });
  });
}
const expLessons = new Set(expected.map(e => e.slug));

// ...and counted off the BUILT markup, which is what actually ships.
function walkHtml(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name === 'dev') continue; walkHtml(p, out); }
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}
const BTN_RE = /<button class="play-btn"[^>]*>/g;
const ANY_SWING_RE = /data-swing="([^"]*)"/g;
let builtTotal = 0, built8 = 0, built16 = 0;
const builtPages = new Set();
let strayAttr = 0;
for (const file of walkHtml(SITE, [])) {
  const html = fs.readFileSync(file, 'utf8');
  let m;
  BTN_RE.lastIndex = 0;
  while ((m = BTN_RE.exec(html))) {
    builtTotal++;
    const s = /data-swing="(\d+)"/.exec(m[0]);
    if (!s) continue;
    builtPages.add(file);
    if (s[1] === '8') built8++; else if (s[1] === '16') built16++;
    else fails.push(`${path.relative(ROOT, file)}: data-swing="${s[1]}" is not 8 or 16`);
  }
  // every data-swing in the document must be on a play button and nowhere else —
  // above all not on the metronome handoff button.
  ANY_SWING_RE.lastIndex = 0;
  const all = (html.match(ANY_SWING_RE) || []).length;
  const onButtons = (html.match(/<button class="play-btn"[^>]*data-swing="[^"]*"/g) || []).length;
  if (all !== onButtons) { strayAttr += all - onButtons; }
}
if (strayAttr) fails.push(`${strayAttr} data-swing attribute(s) sit somewhere other than a play button`);
if (built8 + built16 < POP_FLOOR) {
  fails.push(`only ${built8 + built16} play buttons carry data-swing; the corpus has ${expected.length} and the floor is ${POP_FLOOR}`);
}
if (builtPages.size < POP_LESSON_FLOOR) {
  fails.push(`data-swing reaches only ${builtPages.size} pages; floor is ${POP_LESSON_FLOOR}`);
}
if (built8 + built16 !== expected.length) {
  fails.push(`built markup marks ${built8 + built16} exercises but lessonContent.js says ${expected.length}`);
}
if (built16 !== expected.filter(e => e.level === 16).length) {
  fails.push(`built markup marks ${built16} exercises as swung-16ths, source says ${expected.filter(e => e.level === 16).length}`);
}

// The metronome file must not have learned about swing.
const metroSrc = fs.readFileSync(path.join(ROOT, 'src/assets/js/metronome.js'), 'utf8');
for (const sym of ['data-swing', 'swungOnset', 'straightTime', 'SWING_', 'dataset.swing']) {
  if (metroSrc.indexOf(sym) !== -1) fails.push(`metronome.js references ${sym}; the click is a quarter-note reference and must stay even`);
}
// ...and pattern-math must not, either: it is shared with the audit tooling and
// computes beat counts. A playback offset leaking in there moves BEAT-COUNT.
const pmSrc = fs.readFileSync(path.join(ROOT, 'src/assets/js/pattern-math.js'), 'utf8');
for (const sym of ['swing', 'Swing', 'SWING']) {
  if (pmSrc.indexOf(sym) !== -1) fails.push(`pattern-math.js references ${sym}; it is shared with audit-lessons and must stay a pure duration model`);
}

// Unit: the grid veto, at both levels. No spec in the corpus exercises it (note d
// in the header), so it is asserted directly against a re-derivation of the rule.
function onLevelGrid(spec, level) {
  const step = level === 16 ? 0.25 : 0.5;
  for (const voice of ['hands', 'feet']) {
    const arr = spec[voice] || [];
    const scale = PM.tupletScales(spec, voice, arr.length);
    let u = 0;
    for (let i = 0; i < arr.length; i++) {
      if (Math.abs(u / step - Math.round(u / step)) > 1e-6) return false;
      const ticks = PM.durationTicks(arr[i]);
      if (ticks === null) return false;
      u += ticks * scale[i];
    }
  }
  return true;
}
{
  const hand = (...ds) => ({ timeSignature: '4/4', bpm: 90, hands: ds.map(d => ({ keys: ['f/5/x2'], duration: d })) });
  // A 16th under "swing 8ths": the third onset is at 0.25, which the eighth grid
  // must reject. Under the sixteenth grid this passed, and it is the exact spec
  // that would ship with a 0.083-beat gap and a cursor 0.0625 out.
  if (onLevelGrid(hand('8', '16', '16'), 8)) {
    fails.push('the level-8 grid test accepts a spec containing 16ths; the swung eighth at 2/3 would land 0.083 beats from an unmoved 16th at 0.75');
  }
  // ...and the same spec is legal under "swung 16ths", which divides that grid.
  if (!onLevelGrid(hand('8', '16', '16'), 16)) {
    fails.push('the level-16 grid test rejects a spec of 8ths and 16ths, which is exactly what a swung-16ths exercise is');
  }
  // Three notes so the THIRD onset lands at 0.625 — between the swung eighth's
  // 0.5 and its landing at 0.667. A two-note fixture proves nothing: both its
  // onsets are on the grid.
  if (onLevelGrid(hand('8', '32', '32'), 16)) {
    fails.push('the level-16 grid test accepts a 32nd-note spec; a swung sixteenth would overtake it');
  }
  // The corpus must still fit the tightened rule, or the population silently drops.
  for (const e of expected) {
    if (!onLevelGrid(LC[e.slug].exercises[e.i], e.level)) {
      fails.push(`${e.slug}#${e.i} names a level-${e.level} feel but has an onset off that grid`);
    }
  }
}

// ---- drive the browser ------------------------------------------------------

// One browser attempt: fresh page on disk, fresh profile, fresh port. Returns
// either { res } or { why } — never throws, so the retry loop stays readable.
function browserAttempt() {
  return new Promise((resolve) => {
    writeHarness();
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'dt-swing-'));
      const child = spawn(browser, ['--headless=new', '--disable-gpu', '--no-first-run',
        '--no-default-browser-check', '--user-data-dir=' + profile, '--mute-audio',
        '--autoplay-policy=no-user-gesture-required', '--window-size=1280,900',
        `http://127.0.0.1:${port}/dev/${PAGE_NAME}`], { stdio: ['ignore', 'ignore', 'ignore'] });
      let settled = false;
      const finish = (out) => {
        if (settled) return;
        settled = true;
        deliver = null;
        try { child.kill(); } catch (e) {}
        try { server.close(); } catch (e) {}
        try { fs.rmSync(profile, { recursive: true, force: true }); } catch (e) {}
        resolve(out);
      };
      deliver = (body) => {
        let parsed;
        try { parsed = JSON.parse(body); }
        catch (e) { return finish({ why: 'unreadable harness output: ' + e.message }); }
        finish({ res: parsed });
      };
      child.on('error', (e) => finish({ why: 'the browser would not launch: ' + e.message }));
      setTimeout(() => finish({ why: `no result within ${Math.round(TIMEOUT_MS / 1000)}s (a clean run takes about 10)` }), TIMEOUT_MS);
    });
    server.on('error', (e) => resolve({ why: 'the loopback server failed: ' + e.message }));
  });
}

(async () => {
  let res = null, why = null, attempts = 0, leg = 'browser';
  for (attempts = 1; attempts <= BROWSER_TRIES; attempts++) {
    const got = await browserAttempt();
    if (got.why) { why = got.why; leg = 'browser'; continue; }
    if (got.res.error) { why = 'the harness threw: ' + got.res.error; leg = 'harness-bug'; break; }
    if (got.res.harnessFail) {
      why = got.res.harnessFail.why + ` (after ${got.res.harnessFail.attempts} in-page attempt(s))`;
      leg = got.res.harnessFail.leg;
      continue;
    }
    res = got.res;
    break;
  }
  cleanup();
  // A harness bug in THIS file is not a flake and is not retried; it gets the
  // plain bail so the stack is the first thing on screen.
  if (!res && leg === 'harness-bug') bail(why);
  if (!res) bailHarness(leg, why, Math.min(attempts, BROWSER_TRIES));
  const browserAttempts = attempts;
  if (MUTATE && !mutationApplied) bail(`mutation "${MUTATE}" never reached player.js`);

  const byId = {};
  for (const r of res.cases) byId[r.id] = r;

  // Onsets, in beats from the pattern's first note, measured off the graph.
  function beats(r) {
    const spb = 60 / r.bpm;
    return r.onsets.map(o => (o.t - r.audioStart) / spb);
  }
  function fmt(a) { return a.map(x => x.toFixed(4)).join(' '); }

  // Reported so ATTACK_MIN's margin is visible rather than assumed: on clean code
  // the worst onset should sit far above 4, and a value creeping toward it means
  // two hits are colliding and the detector is about to become the failure.
  const worstAttack = { v: Infinity, at: 'none' };
  const worstSilence = { v: -Infinity, at: 'none' };
  const headBand = [];

  // Local cursor speed between consecutive scan samples, in straight-beats per
  // swung-beat: d(progress)*patternBeats / d(time-in-beats). Correct code produces
  // 0.75 and 1.5 and blends of the two.
  function slopesOf(r) {
    const spb = 60 / r.bpm;
    const out = [];
    for (let i = 1; i < (r.scan || []).length; i++) {
      const a = r.scan[i - 1], b = r.scan[i];
      if (a.progress === null || b.progress === null) continue;
      const dt = (b.t - a.t) / spb;
      if (dt <= 0) continue;
      out.push(((b.progress - a.progress) * r.patternBeats) / dt);
    }
    return out;
  }

  // Every case's baseline must reproduce PatternMath's straight grid exactly:
  // if it does not, the harness is measuring something other than the player.
  for (const kase of CASES) {
    const r = byId[kase.id];
    // Absent or short measurements are the instrument, not the subject: the
    // harness already retried and would have bailed, so reaching here means
    // something structural. Route it through the same exit as every other
    // could-not-measure so it never reads as a swing defect.
    if (!r) bailHarness('audio', `${kase.id}: no measurement came back for this case`, browserAttempts);
    const ex = LC[kase.slug].exercises[kase.ex];
    const grid = straightOnsets(ex, kase.keep).map(o => o.u);
    const got = beats(r);
    if (got.length !== grid.length) {
      bailHarness('audio', `${kase.id}: ${got.length} onsets came back, the spec has ${grid.length} on the kept voice`, browserAttempts);
    }
    // gain products: the isolated voice is at full level unless the content
    // ghosts or taps it, so report the set and fail only on an unreachable node.
    const bad = r.onsets.filter(o => o.level === null);
    if (bad.length) bailHarness('audio', `${kase.id}: ${bad.length} source node(s) never reach destination (${bad[0].chain}) — the graph walk lost the edge, so no level below is trustworthy`, browserAttempts);
    // every scheduled onset must be a real attack in the rendered samples
    r.attacks.forEach((a, i) => {
      if (a !== null && a < worstAttack.v) { worstAttack.v = a; worstAttack.at = `${kase.id} onset ${i}`; }
      if (a !== null && a < ATTACK_MIN) {
        fails.push(`${kase.id}: no attack in the render at onset ${i} (t=${r.onsets[i].t.toFixed(4)}s, post/pre=${a.toFixed(2)}, needs >${ATTACK_MIN})`);
      }
    });
  }

  // ---- the exercises that must swing ----
  const table = [];
  for (const [shipId, baseId, level] of SWUNG_PAIRS) {
    const S = byId[shipId], B = byId[baseId];
    if (!S || !B) continue;
    const kase = CASES.find(c => c.id === shipId);
    const ex = LC[kase.slug].exercises[kase.ex];
    const grid = straightOnsets(ex, kase.keep).map(o => o.u);
    const sb = beats(S), bb = beats(B);

    if (S.builtAttr !== String(level)) {
      fails.push(`${shipId}: the built page says data-swing="${S.builtAttr}", expected "${level}"`);
    }
    const wantCell = level === 16 ? 0.5 : 1;
    if (S.feel !== wantCell) fails.push(`${shipId}: the session's cell is ${S.feel}, expected ${wantCell}`);
    if (B.feel !== null) fails.push(`${baseId}: the baseline still has a feel (${B.feel}) — it is not a straight control`);
    if (Math.abs(S.patternDuration - B.patternDuration) > 1e-9) {
      fails.push(`${shipId}: pattern duration moved with the swing (${S.patternDuration} vs ${B.patternDuration}) — swing is an offset, not a length`);
    }
    // baseline == the straight grid
    bb.forEach((v, i) => {
      if (Math.abs(v - grid[i]) > ONSET_TOL) {
        fails.push(`${baseId}: onset ${i} at ${v.toFixed(5)} beats, straight grid says ${grid[i]}`);
      }
    });
    // shipped == the grid with exactly the off-subdivisions displaced
    const cell = level === 8 ? 1 : 0.5;
    let moved = 0;
    sb.forEach((v, i) => {
      const u = grid[i];
      const base = Math.floor(u / cell + 1e-9) * cell;
      const p = u - base;
      const want = Math.abs(p - cell / 2) < 1e-9 ? base + cell * (2 / 3) : u;
      if (Math.abs(p - cell / 2) < 1e-9) moved++;
      if (Math.abs(v - want) > ONSET_TOL) {
        fails.push(`${shipId}: onset ${i} straight ${u} -> measured ${v.toFixed(5)}, expected ${want.toFixed(5)} beats`);
      }
    });
    if (!moved) fails.push(`${shipId}: nothing in this exercise sits on the subdivision the meta moves — wrong case`);

    // the pair test the acceptance names: the two halves must not be equal
    const pairs = [];
    for (let i = 0; i + 1 < sb.length; i++) {
      const u = grid[i], base = Math.floor(u / cell + 1e-9) * cell;
      if (Math.abs(u - base) > 1e-9) continue;              // must start on the cell
      if (Math.abs(grid[i + 1] - (base + cell / 2)) > 1e-9) continue;  // ...and be followed by the off one
      const first = sb[i + 1] - sb[i];
      const second = (i + 2 < sb.length && Math.abs(grid[i + 2] - (base + cell)) < 1e-9)
        ? sb[i + 2] - sb[i + 1]
        : (base + cell) - sb[i + 1];                        // the cell boundary closes the pair
      pairs.push({ base, first, second });
    }
    if (!pairs.length) fails.push(`${shipId}: found no on-beat/off-beat pair to measure`);
    for (const p of pairs) {
      const ratio = p.first / p.second;
      const uneven = Math.abs(p.first - p.second) / (p.first + p.second);
      if (Math.abs(ratio - RATIO) > RATIO_TOL) {
        fails.push(`${shipId}: the pair starting at beat ${p.base} is ${p.first.toFixed(4)}:${p.second.toFixed(4)} = ${ratio.toFixed(4)}, expected ${RATIO}`);
      }
      if (uneven < UNEVEN_MIN) {
        fails.push(`${shipId}: the two halves of the cell at beat ${p.base} are evenly spaced (imbalance ${uneven.toFixed(4)})`);
      }
    }
    // ...and the straight baseline's same pairs must be even
    for (let i = 0; i + 2 < bb.length; i++) {
      const u = grid[i], base = Math.floor(u / cell + 1e-9) * cell;
      if (Math.abs(u - base) > 1e-9) continue;
      if (Math.abs(grid[i + 1] - (base + cell / 2)) > 1e-9) continue;
      if (Math.abs(grid[i + 2] - (base + cell)) > 1e-9) continue;
      const a = bb[i + 1] - bb[i], b = bb[i + 2] - bb[i + 1];
      if (Math.abs(a - b) > EVEN_TOL) fails.push(`${baseId}: the straight baseline is not even at beat ${base} (${a} vs ${b})`);
    }

    // swung 16ths must leave the EIGHTHS alone
    if (level === 16) {
      let checked = 0;
      for (let i = 0; i + 2 < sb.length; i++) {
        if (Math.abs(grid[i] % 0.5) > 1e-9 || Math.abs(grid[i + 2] - (grid[i] + 0.5)) > 1e-9) continue;
        const gap = sb[i + 2] - sb[i];
        checked++;
        if (Math.abs(gap - 0.5) > ONSET_TOL) {
          fails.push(`${shipId}: swung 16ths moved an EIGHTH — the gap from ${grid[i]} to ${grid[i] + 0.5} measures ${gap.toFixed(5)} beats`);
        }
      }
      if (!checked) fails.push(`${shipId}: could not find an eighth-to-eighth span to check`);
    }

    // the vacated straight positions must be silent in the render
    S.probes.forEach(pr => {
      if (pr.ratio !== null && pr.ratio > worstSilence.v) { worstSilence.v = pr.ratio; worstSilence.at = `${shipId} ${pr.t.toFixed(3)}s`; }
      if (pr.ratio !== null && pr.ratio > SILENCE_MAX) {
        fails.push(`${shipId}: the render still has an attack at the STRAIGHT position ${pr.t.toFixed(4)}s (post/pre=${pr.ratio.toFixed(2)})`);
      }
    });
    B.probes.forEach(pr => {
      if (pr.ratio !== null && pr.ratio < ATTACK_MIN) {
        fails.push(`${baseId}: the straight baseline has no attack at ${pr.t.toFixed(4)}s (post/pre=${pr.ratio.toFixed(2)}) — the probe positions are wrong`);
      }
    });

    // ---- the playhead: the fixed points, and the slope between them ----
    if (S.headErr) bailHarness('playhead', `${shipId}: ${S.headErr}`, browserAttempts);
    {
      S.head.forEach((h, i) => {
        const want = grid[i] / S.patternBeats;
        if (h.progress === null) { fails.push(`${shipId}: playhead has no span`); return; }
        if (Math.abs(h.progress - want) > HEAD_TOL) {
          fails.push(`${shipId}: when onset ${i} (straight beat ${grid[i]}) sounds the playhead is at ${h.progress.toFixed(4)} of the pattern, the notehead is at ${want.toFixed(4)}`);
        }
      });
      const sl = slopesOf(S);
      if (sl.length < 10) bailHarness('playhead', `${shipId}: only ${sl.length} usable playhead scan samples came back, ${HEAD_SCAN_N} were requested`, browserAttempts);
      const lo = Math.min(...sl), hi = Math.max(...sl);
      if (lo < HEAD_SLOPE_LO - HEAD_SLOPE_TOL || hi > HEAD_SLOPE_HI + HEAD_SLOPE_TOL) {
        fails.push(`${shipId}: the playhead's speed leaves its band — measured ${lo.toFixed(3)}..${hi.toFixed(3)} straight-beats per swung-beat, allowed ${HEAD_SLOPE_LO}..${HEAD_SLOPE_HI}. A value far above the top is the cursor jumping at a cell boundary; one stuck near 1.000 is the slope having been dropped.`);
      }
      if (hi < HEAD_SLOPE_HI - HEAD_SLOPE_TOL) {
        fails.push(`${shipId}: the playhead never reaches ${HEAD_SLOPE_HI}x speed (max ${hi.toFixed(3)}) — it is not catching up across the short half of the cell, so mid-cell it lags the notes`);
      }
      if (lo > HEAD_SLOPE_LO + HEAD_SLOPE_TOL) {
        fails.push(`${shipId}: the playhead never slows to ${HEAD_SLOPE_LO}x (min ${lo.toFixed(3)}) — it is not waiting through the long half of the cell`);
      }
      headBand.push(`${shipId.split('/')[0]} ${lo.toFixed(3)}-${hi.toFixed(3)}`);
    }

    const p0 = pairs[0];
    table.push({
      id: shipId.split('/')[0], level, bpm: S.bpm,
      straight: fmt(bb.slice(0, 6)), swung: fmt(sb.slice(0, 6)),
      ratio: p0 ? (p0.first / p0.second) : null,
      long: p0 ? p0.first : null, short: p0 ? p0.second : null,
      levels: [...new Set(S.onsets.map(o => (o.level === null ? 'x' : o.level.toFixed(3))))].join(','),
      src: [...new Set(S.onsets.map(o => o.desc))].join(',')
    });
  }

  // ---- the controls: told to swing, and refusing ----
  for (const [aId, bId, why] of IDENTICAL_PAIRS) {
    const A = byId[aId], B = byId[bId];
    if (!A || !B) { fails.push(`${aId}/${bId}: missing measurement`); continue; }
    if (A.builtAttr !== null && A.builtAttr !== undefined) {
      fails.push(`${aId}: the build marked a tupleted spec with data-swing="${A.builtAttr}"`);
    }
    // ANTI-VACUITY. chapin75 and shuffle80 are tupleted end to end, so "nothing
    // moved" would also be the reading if the forced attribute had never been
    // seen at all. The session's own feel is read to prove the player accepted
    // the instruction and declined anyway.
    if (B.feel === null || B.feel === undefined) {
      fails.push(`${bId}: data-swing was forced on but the player built no feel — this control proves nothing`);
    }
    const kase = CASES.find(c => c.id === aId);
    const spec = LC[kase.slug].exercises[kase.ex];
    const grid = straightOnsets(spec, kase.keep);
    const ab = beats(A), bb = beats(B);
    if (ab.length !== bb.length || ab.length !== grid.length) {
      fails.push(`${aId} vs ${bId}: onset counts differ (${ab.length}/${bb.length}/${grid.length})`);
      continue;
    }
    let worst = 0, at = -1, compared = 0, movedFree = 0;
    ab.forEach((v, i) => {
      if (grid[i].scale !== 1) {
        compared++;
        const d = Math.abs(v - bb[i]);
        if (d > worst) { worst = d; at = i; }
      } else if (Math.abs(bb[i] - ab[i]) > ONSET_TOL) movedFree++;
    });
    if (!compared) fails.push(`${aId}: no tupleted note to compare — wrong case`);
    if (worst > ONSET_TOL) {
      fails.push(`${why}: ${bId} moved TUPLETED onset ${at} by ${worst.toFixed(5)} beats against ${aId} (${ab[at]} -> ${bb[at]})`);
    }
    // sextuplet70's first six notes are ordinary eighths; forcing the flag on
    // SHOULD move them, and if it does not the case is passing for the wrong
    // reason.
    const freeOffBeats = grid.filter(g => g.scale === 1 && Math.abs((g.u % 1) - 0.5) < 1e-9).length;
    if (freeOffBeats && !movedFree) {
      fails.push(`${bId}: ${freeOffBeats} untupleted off-beat(s) did not move under a forced data-swing`);
    }
    table.push({ id: aId.split('/')[0], level: `tuplet(${compared})`, bpm: A.bpm, straight: fmt(ab.slice(0, 6)),
      swung: fmt(bb.slice(0, 6)), ratio: null, long: null, short: null,
      levels: [...new Set(A.onsets.map(o => (o.level === null ? 'x' : o.level.toFixed(3))))].join(','),
      src: [...new Set(A.onsets.map(o => o.desc))].join(',') });
  }

  // ---- the gain product, made load-bearing ----
  // voices140 keeps the hi-hat line and the pedaled hi-hat. Both are
  // hat_closed.wav, so the buffer descriptor is identical on all eight onsets and
  // a sample-URL reading would report one voice. The constant-gain product splits
  // them 1.000 / 0.550, and the two behave differently under the feel: the hat's
  // off-beats move, the pedal's beats 2 and 4 do not.
  let gainLine = 'not measured';
  {
    const r = byId['voices140/built'];
    if (!r) fails.push('voices140/built: missing measurement');
    else {
      const descs = [...new Set(r.onsets.map(o => o.desc))];
      const levels = r.onsets.map(o => o.level);
      const full = levels.filter(v => Math.abs(v - 1) < 1e-6).length;
      const pedal = levels.filter(v => Math.abs(v - 0.55) < 1e-6).length;
      if (descs.length !== 1) {
        fails.push(`voices140/built: expected one shared buffer across both voices, got ${descs.join(',')} — this case exists to show the buffer cannot separate them`);
      }
      if (full !== 6 || pedal !== 2) {
        fails.push(`voices140/built: gain products split ${full} at 1.000 and ${pedal} at 0.550; expected 6 hat and 2 pedal (levels seen: ${[...new Set(levels)].join(',')})`);
      }
      const spb = 60 / r.bpm;
      const pedalBeats = r.onsets.filter(o => Math.abs(o.level - 0.55) < 1e-6)
        .map(o => (o.t - r.audioStart) / spb);
      pedalBeats.forEach(b => {
        if (Math.abs(b - Math.round(b)) > ONSET_TOL) {
          fails.push(`voices140/built: the pedaled hi-hat is on beat ${b.toFixed(4)}; it sits on 2 and 4 and nothing should have moved it`);
        }
      });
      gainLine = `${descs[0]} on all ${r.onsets.length} onsets, split ${full}x1.000 (hat) / ${pedal}x0.550 (pedal); pedal beats ${pedalBeats.map(b => b.toFixed(3)).join(', ')} unmoved`;
    }
  }

  // ---- the straight control ----
  {
    const r = byId['straight80/built'];
    if (!r) fails.push('straight80/built: missing measurement');
    else {
      if (r.builtAttr) fails.push(`straight80/built: an exercise with no feel in its meta carries data-swing="${r.builtAttr}"`);
      const b = beats(r);
      const iois = [];
      for (let i = 1; i < b.length; i++) iois.push(b[i] - b[i - 1]);
      const min = Math.min(...iois), max = Math.max(...iois);
      if (max - min > EVEN_TOL) {
        fails.push(`straight80/built: a straight exercise's eighths are not evenly spaced (${min.toFixed(5)}..${max.toFixed(5)} beats)`);
      }
      // The scanner's own control: with no feel the cursor is a plain linear
      // sweep, so every sample must read 1.000. If this drifts, the slope band
      // asserted on the swung cases is measuring the harness, not the player.
      if (!r.headErr) {
        const sl = slopesOf(r);
        const lo = Math.min(...sl), hi = Math.max(...sl);
        if (lo < 1 - HEAD_SLOPE_TOL || hi > 1 + HEAD_SLOPE_TOL) {
          fails.push(`straight80/built: an exercise with no feel must sweep at 1.000x; measured ${lo.toFixed(3)}..${hi.toFixed(3)}`);
        }
        headBand.push(`straight80 ${lo.toFixed(3)}-${hi.toFixed(3)}`);
      }
      table.push({ id: 'straight80', level: 'straight', bpm: r.bpm, straight: fmt(b.slice(0, 6)),
        swung: fmt(b.slice(0, 6)), ratio: iois.length ? 1 : null, long: min, short: max,
        levels: [...new Set(r.onsets.map(o => (o.level === null ? 'x' : o.level.toFixed(3))))].join(','),
        src: [...new Set(r.onsets.map(o => o.desc))].join(',') });
    }
  }

  // ---- the metronome ----
  let metroLine = 'not measured';
  if (!res.metro || !res.metro.clicks) {
    bailHarness('metronome', 'the dock produced no clicks', browserAttempts);
  } else {
    const cl = res.metro.clicks;
    // Short click lists are unmeasured, not uneven — the harness retries them and
    // bails through the instrument path, so reaching here with fewer than 4 means
    // the retry logic itself is wrong.
    if (cl.length < 4) bailHarness('metronome', `only ${cl.length} clicks came back after ${METRO_TRIES} in-page attempts`, browserAttempts);
    {
      const want = 60 / res.metro.bpm;
      const iois = [];
      for (let i = 1; i < cl.length; i++) iois.push(cl[i].t - cl[i - 1].t);
      const min = Math.min(...iois), max = Math.max(...iois);
      if (max - min > METRO_TOL || Math.abs(min - want) > METRO_TOL) {
        fails.push(`the metronome click is not even at ${res.metro.bpm} BPM: intervals ${min.toFixed(4)}..${max.toFixed(4)}s, expected ${want.toFixed(4)}s`);
      }
      metroLine = `${cl.length} clicks at ${res.metro.bpm} BPM, spacing ${min.toFixed(4)}-${max.toFixed(4)}s against ${want.toFixed(4)}s (a swung click would read ${(want * 2 / 3).toFixed(4)}/${(want / 3).toFixed(4)})`;
    }
  }

  // ---- report ----
  if (fails.length) {
    console.error('[check-swing-feel] FAIL:');
    fails.slice(0, 40).forEach(f => console.error('  ' + f));
    if (fails.length > 40) console.error(`  ...and ${fails.length - 40} more`);
    console.error('');
    console.error('  The feel is derived in .eleventy.js (swingLevelFor) and applied in');
    console.error('  src/assets/js/player.js (swungOnset / straightTime). A swung eighth lands');
    console.error('  at 2/3 of its beat because hi-hat-articulation#3 and the-shuffle#0 both say');
    console.error('  so in prose; a spec that already notates the feel as tuplets is never');
    console.error('  marked and is never displaced.');
    process.exit(1);
  }

  console.log(`[check-swing-feel] OK — ${built8 + built16} exercises across ${builtPages.size} lessons carry a feel ` +
    `(${built8} swing-8ths, ${built16} swung-16ths, of ${builtTotal} play buttons); ` +
    `${vetoed.length} named a feel and were vetoed: ${vetoed.join(', ')}.`);
  console.log('  inter-onset intervals, measured through the shipped player in an OfflineAudioContext:');
  console.log('    (left = the run without the feel, right = with it; for the tuplet controls, left = as built and right = told to swing)');
  console.log('    case          feel        bpm  first 6 onsets, in beats                     ->  with the feel applied                         long:short  ratio');
  for (const t of table) {
    const r = t.ratio === null ? '  -  ' : t.ratio.toFixed(4);
    const ls = (t.long === null) ? '     -     ' : `${t.long.toFixed(4)}:${t.short.toFixed(4)}`;
    console.log(`    ${t.id.padEnd(13)} ${String(t.level).padEnd(11)} ${String(t.bpm).padStart(3)}  ${t.straight.padEnd(44)} -> ${t.swung.padEnd(44)} ${ls} ${r}`);
  }
  console.log(`  gain product to destination (constant nodes only), two voices in one render: ${gainLine}`);
  console.log(`  metronome: ${metroLine}`);
  console.log(`  onset detection in the rendered samples: weakest attack ${worstAttack.v.toFixed(2)} (${worstAttack.at}) against a floor of ${ATTACK_MIN}; ` +
    `loudest vacated straight position ${worstSilence.v === -Infinity ? 'n/a' : worstSilence.v.toFixed(2)} (${worstSilence.at}) against a ceiling of ${SILENCE_MAX}`);
  console.log('  playhead, in TIME: exact at every onset (within ' + HEAD_TOL + ' of the pattern), and its speed between onsets ' +
    `swept at ${HEAD_SCAN_N} samples per pattern — ${headBand.join(', ')} straight-beats per swung-beat ` +
    `(${HEAD_SLOPE_LO}/${HEAD_SLOPE_HI} is the correct pair; 1.000 for the no-feel control). BL-143 owns the SPACE axis and is untouched.`);
  // Retries are REPORTED, not swallowed. A silent retry hides the same thing a
  // silent failure does; if these stop reading 1/0 the environment has changed.
  const caseRetries = res.cases.reduce((n, r) => n + ((r.attempts || 1) - 1), 0);
  const metroRetries = ((res.metro && res.metro.attempts) || 1) - 1;
  console.log(`  harness: browser attempt ${browserAttempts} of ${BROWSER_TRIES}, ${caseRetries} case retry/retries across ${res.cases.length} cases, ${metroRetries} metronome retry/retries.`);
  if (MUTATE) console.log(`  NOTE: run under BL128_MUTATE=${MUTATE} and it PASSED — that mutant is a silent hole.`);
  process.exit(0);
})();
