// audit-tip-claims.js — a REPORTING TOOL, not a gate. Run it by hand.
//
// It over-reports on purpose, and it is not precise enough to be a check yet.
// Of the 13 it raised on 2026-08-08, six were false positives in two classes:
//   1. GHOST NOTES. Ghosts are also c/5, so a tip saying "snare on 2 and 4"
//      looks wrong on a bar that has a correct backbeat plus ghosts around it.
//      Fixable: prefer notes carrying accent:true when any exist in the bar.
//   2. COMPOUND AND SHUFFLE METERS. This counts in quarter-note beats, so a
//      12/8 shuffle reports its backbeat at 2.5 and 5.5. Fixable: read
//      timeSignature and count in the beat unit the tip is using.
// Until both are handled it must not be wired into tools/checks — a gate that
// cries wolf six times out of thirteen trains people to ignore it.
//
// Compare what an exercise TIP claims about snare placement against what the
// notation actually plays. The tips are prose a student reads at the moment of
// practice, inches from the staff, so a disagreement teaches the wrong thing.
const lc = require('c:/Users/dylan/repos/drum-town/src/_data/lessonContent.js');

const DUR = { w: 4, h: 2, q: 1, 8: 0.5, 16: 0.25, 32: 0.125 };
const SNARE = /^c\/5$/;

// Where does each note start, in beats from the top of the bar?
function positions(voice) {
  let t = 0; const out = [];
  for (const n of voice || []) {
    const base = DUR[String(n.duration).replace(/[^whq0-9]/g, '')] ?? 0;
    const len = /\./.test(String(n.duration)) ? base * 1.5 : base;
    out.push({ beat: t, keys: n.keys || [], rest: /r/.test(String(n.duration)) || n.rest === true });
    t += len;
  }
  return out;
}

function snareBeats(ex) {
  return positions(ex.hands)
    .filter(p => !p.rest && (p.keys || []).some(k => SNARE.test(k)))
    .map(p => +(p.beat + 1).toFixed(3));   // 1-indexed beats
}

const results = [];
for (const [slug, l] of Object.entries(lc)) {
  (l.exercises || []).forEach((ex, i) => {
    const tip = ex.tip || '';
    // Only the claims that are unambiguous enough to check mechanically.
    const m = tip.match(/snare (?:is |sits |stays |still )?(?:on|lands on)\s+(\d)\s*(?:and|&|,)\s*(\d)/i);
    if (!m) return;
    const claimed = [Number(m[1]), Number(m[2])];
    const actual = snareBeats(ex);
    const onBeats = actual.filter(b => Number.isInteger(b));
    const offBeats = actual.filter(b => !Number.isInteger(b));
    const match = claimed.every(c => actual.includes(c)) && offBeats.length === 0;
    results.push({ slug, i, title: ex.title, claimed, actual, match, snippet: m[0] });
  });
}

const bad = results.filter(r => !r.match);
console.log('tips making a checkable "snare on X and Y" claim: ' + results.length);
console.log('claims the notation does NOT support: ' + bad.length + '\n');
for (const b of bad) {
  console.log(`  ${b.slug}#${b.i}  ${b.title}`);
  console.log(`     tip says : "${b.snippet}"`);
  console.log(`     notation : snare on beats ${b.actual.join(', ') || '(none)'}`);
}
