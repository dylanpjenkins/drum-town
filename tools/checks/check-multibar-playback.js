// tools/checks/check-multibar-playback.js
// The player must delegate timing to the shared PatternMath module (which is
// multi-bar, dotted-note, and tuplet aware), and that math must measure known
// shapes correctly. Exit 0 = pass.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const PM = require(path.join(ROOT, 'src/assets/js/pattern-math.js'));
const playerSrc = fs.readFileSync(path.join(ROOT, 'src/assets/js/player.js'), 'utf8');

const fails = [];

// Structural: the player uses the shared module, not private one-bar math.
if (!/PatternMath\.patternDurationSecs/.test(playerSrc)) fails.push('player.js does not use PatternMath.patternDurationSecs for loop length');
if (!/PatternMath\.durationTicks/.test(playerSrc)) fails.push('player.js does not use PatternMath.durationTicks for note timing');
if (/function\s+barDurationSecs/.test(playerSrc)) fails.push('player.js still defines single-bar barDurationSecs');

// Unit: two bars of 4/4 quarters at 60 bpm = 8 beats = 8 seconds.
const twoBar = { timeSignature: '4/4', bpm: 60, hands: Array.from({ length: 8 }, () => ({ keys: ['c/5'], duration: 'q' })) };
if (PM.patternBeats(twoBar) !== 8) fails.push(`patternBeats: 2-bar spec expected 8, got ${PM.patternBeats(twoBar)}`);
if (PM.patternDurationSecs(twoBar) !== 8) fails.push(`patternDurationSecs: expected 8s, got ${PM.patternDurationSecs(twoBar)}`);

// Unit: dotted quarter = 1.5 quarter-note units.
if (PM.durationTicks({ duration: 'q', dot: true }) !== 1.5) fails.push('durationTicks: dotted quarter expected 1.5');

// Unit: an eighth-note triplet (3 in the space of 2) totals one beat.
const trip = {
  timeSignature: '4/4', bpm: 120,
  hands: [{ keys: ['c/5'], duration: '8' }, { keys: ['c/5'], duration: '8' }, { keys: ['c/5'], duration: '8' }],
  tuplets: [{ voice: 'hands', start: 0, length: 3, num_notes: 3, notes_occupied: 2 }]
};
const tv = PM.voiceTicks(trip, 'hands');
if (Math.abs(tv - 1) > 1e-9) fails.push(`voiceTicks: eighth triplet expected 1 beat, got ${tv}`);

// Content sweep: every over-length exercise must measure as a whole number of
// bars (audit-lessons guarantees 0 beat mismatches; a fractional ratio here
// would mean PatternMath disagrees with the notation).
const lc = require(path.join(ROOT, 'src/_data/lessonContent.js'));
let multi = 0;
const nonIntegral = [];
for (const [slug, l] of Object.entries(lc)) {
  (l.exercises || []).forEach((ex, i) => {
    if (!ex.timeSignature) return;
    const [num, den] = ex.timeSignature.split('/').map(Number);
    const bar = ex.expectedBeats || num * (4 / den);
    const ratio = PM.patternBeats(ex) / bar;
    if (ratio > 1.01) {
      multi++;
      if (Math.abs(ratio - Math.round(ratio)) > 0.01) nonIntegral.push(`${slug}#${i} ratio=${ratio.toFixed(3)}`);
    }
  });
}
if (multi === 0) fails.push('expected multi-bar exercises in content, found none — sweep is broken');
if (nonIntegral.length) fails.push(`non-integral bar ratios: ${nonIntegral.slice(0, 5).join(', ')}`);

if (fails.length) {
  console.error('[check-multibar-playback] FAIL:');
  fails.forEach(f => console.error('  ' + f));
  process.exit(1);
}
console.log(`[check-multibar-playback] OK — player delegates to PatternMath; ${multi} multi-bar exercises measure as whole bars`);
