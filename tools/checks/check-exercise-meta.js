// tools/checks/check-exercise-meta.js
// The meta line under an exercise title is a promise about what pressing
// Play will do. There is no per-exercise tempo control, so a meta reading
// "♩ = 70 → 100" against bpm:80 advertises something the player cannot do —
// practice ranges belong in the tip (docs/content-style-guide.md).
//
// Rule: the LAST tempo stated in the meta must equal spec.bpm, and the LAST
// time signature stated must equal spec.timeSignature. "Last wins" is what
// makes legitimate modulation metas pass — "♩ = 80 → ♩ = 160 (notated at the
// new feel)" with bpm:160 is describing the exercise correctly, whereas a
// practice range is not.
// Exit 0 = clean.

const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const lessonContent = require(path.join(ROOT, 'src/_data/lessonContent.js'));

const findings = [];
let checked = 0;

for (const [slug, lesson] of Object.entries(lessonContent)) {
  (lesson.exercises || []).forEach((ex, i) => {
    const meta = ex.meta;
    if (!meta) return;
    checked++;
    const label = `${slug}#${i} "${ex.title || ''}"`;

    // A modulation meta may legitimately name two tempos. An explicit
    // "notated at ♩ = N" clause declares which one playback uses and wins;
    // otherwise the last tempo named is taken as the promise.
    const declared = /notated at\s*♩\s*=\s*(\d+)/.exec(meta);
    const tempos = [...meta.matchAll(/♩\s*=\s*(\d+)/g)].map(m => Number(m[1]));
    if (ex.bpm && (declared || tempos.length)) {
      const promised = declared ? Number(declared[1]) : tempos[tempos.length - 1];
      if (promised !== ex.bpm) {
        findings.push(`${label}\n      meta promises ♩=${promised} but playback is bpm=${ex.bpm} — meta: "${meta}"`
          + `\n      (a two-tempo modulation should say "· notated at ♩ = ${ex.bpm}")`);
      }
    }

    // Meta prose legitimately narrates a journey through meters ("4/4 → 7/8",
    // "5/4 with implied 7/8 grouping") while the spec notates one portion of
    // it, so only hold the meta to its meter when it claims a single one.
    const journey = /→|->|\+|\bthen\b|\bimplied\b|\bportion\b/.test(meta);
    const sigs = [...meta.matchAll(/\b(\d{1,2}\/\d{1,2})\b/g)]
      .map(m => m[1])
      .filter(s => /^(2|3|4|5|6|7|9|11|12)\/(2|4|8|16)$/.test(s));
    if (!journey && sigs.length && ex.timeSignature && sigs[0] !== ex.timeSignature) {
      findings.push(`${label}\n      meta says ${sigs[0]} but the spec renders ${ex.timeSignature} — meta: "${meta}"`);
    }
  });
}

if (findings.length) {
  console.error(`[check-exercise-meta] FAIL: ${findings.length} meta line(s) promise something playback does not do`);
  findings.forEach(f => console.error('  ' + f));
  console.error('\n  The meta states what Play does. Practice ranges go in the tip.');
  process.exit(1);
}
console.log(`[check-exercise-meta] OK — all ${checked} exercise metas match their spec`);
