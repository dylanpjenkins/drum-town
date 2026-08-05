// tools/checks/check-notation-frame.js
// Nothing a stave draws may fall outside its viewBox.
//
// Tuplet brackets sit above the stave (hands) or below it (feet), beyond the
// stems and flags. With the viewBox pinned to "0 0 w h" those brackets were
// drawn at negative y and silently clipped, so every shuffle lesson rendered
// without the "3" that is the entire point of the exercise (iter 31). The
// renderer now grows the frame to the drawn content; this gate proves it
// stays that way. Exit 0 = clean.

const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const { renderPattern } = require(path.join(ROOT, 'tools/notation-renderer.js'));
const lessonContent = require(path.join(ROOT, 'src/_data/lessonContent.js'));

let rudiments = null;
try { rudiments = require(path.join(ROOT, 'src/_data/rudiments.js')); } catch (e) {}

const TOL = 0.5;
const findings = [];
let checked = 0;

function inspect(label, spec) {
  if (!spec || !spec.timeSignature) return;
  let svg;
  try { svg = renderPattern(spec); } catch (e) { findings.push(`${label}: render threw — ${e.message}`); return; }
  if (/notation-error/.test(svg)) { findings.push(`${label}: renderer returned an error block`); return; }
  const vb = /viewBox="([-\d.]+) ([-\d.]+) ([\d.]+) ([\d.]+)"/.exec(svg);
  if (!vb) { findings.push(`${label}: no parsable viewBox`); return; }
  checked++;
  const vy = parseFloat(vb[2]);
  const vh = parseFloat(vb[4]);
  const frameBottom = vy + vh;

  let minY = Infinity;
  let maxY = -Infinity;
  for (const m of svg.matchAll(/\sy="(-?[\d.]+)"/g)) minY = Math.min(minY, parseFloat(m[1]));
  for (const m of svg.matchAll(/\sy="(-?[\d.]+)"[^>]*?height="([\d.]+)"/g)) {
    maxY = Math.max(maxY, parseFloat(m[1]) + parseFloat(m[2]));
  }
  if (minY !== Infinity && minY < vy - TOL) {
    findings.push(`${label}: draws ${(vy - minY).toFixed(0)}px ABOVE the frame (bracket clipped)`);
  }
  if (maxY !== -Infinity && maxY > frameBottom + TOL) {
    findings.push(`${label}: draws ${(maxY - frameBottom).toFixed(0)}px BELOW the frame (bracket clipped)`);
  }
}

for (const [slug, lesson] of Object.entries(lessonContent)) {
  (lesson.exercises || []).forEach((ex, i) => inspect(`${slug}#${i}`, ex));
}
if (rudiments) {
  for (const group of Object.values(rudiments)) {
    const list = Array.isArray(group) ? group : (group && group.rudiments) || [];
    for (const r of list) {
      if (r && r.spec) inspect(`rudiment:${r.slug || r.name || '?'}.spec`, r.spec);
      if (r && r.card) inspect(`rudiment:${r.slug || r.name || '?'}.card`, r.card);
    }
  }
}

if (findings.length) {
  console.error(`[check-notation-frame] FAIL: ${findings.length} stave(s) draw outside their frame`);
  findings.slice(0, 25).forEach(f => console.error('  ' + f));
  if (findings.length > 25) console.error(`  … and ${findings.length - 25} more`);
  process.exit(1);
}
console.log(`[check-notation-frame] OK — all ${checked} staves fit inside their viewBox`);
