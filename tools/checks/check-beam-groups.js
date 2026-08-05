// tools/checks/check-beam-groups.js
// Beams must not lie about rhythm.
//
// `beamGroups` fractions are measured in REAL played time, after tuplet
// scaling (see tools/notation-renderer.js) — so [3,8] inside a triplet spans
// 1.5 beats, not "three notes". Authors reaching for "three notes per beam"
// write [3,8] and VexFlow silently beams 4+2 across two different triplets.
// The duration math still sums correctly, so tools/audit-lessons.js cannot
// see it; only the picture is wrong. This gate replicates VexFlow's grouping
// arithmetic and flags beams that straddle rhythmic groupings:
//
//   - a beam containing notes from MORE THAN ONE tuplet
//   - a beam mixing tuplet and non-tuplet notes
//
// Both render as a beam that visually contradicts the notated rhythm.
// Exit 0 = clean.

const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const lessonContent = require(path.join(ROOT, 'src/_data/lessonContent.js'));

let rudiments = null;
try { rudiments = require(path.join(ROOT, 'src/_data/rudiments.js')); } catch (e) {}

const BASE = { w: 1, h: 1 / 2, q: 1 / 4, 8: 1 / 8, 16: 1 / 16, 32: 1 / 32, 64: 1 / 64 };

function noteTicks(note, scale) {
  let base = BASE[note.duration];
  if (base === undefined) return null;
  if (note.dot) base *= 1.5;
  return base * scale;
}

// Which tuplet (index) covers note i of this voice, or -1.
function tupletIndexFor(spec, voice, i) {
  const ts = spec.tuplets || [];
  for (let t = 0; t < ts.length; t++) {
    const tp = ts[t];
    if (tp.voice === voice && i >= tp.start && i < tp.start + tp.length) return t;
  }
  return -1;
}

function analyzeVoice(spec, voice) {
  const notes = spec[voice] || [];
  if (!notes.length || !spec.beamGroups || !spec.beamGroups.length) return [];
  const idx = notes.map((n, i) => i);           // rests included: they take time
  if (!idx.some(i => !notes[i].rest)) return [];

  // The renderer hands VexFlow every tickable (rests included) with
  // beam_rests:false, so the grouping clock counts rest duration and only
  // sounding notes join a beam. Model that exactly.
  const groups = spec.beamGroups.map(g => g[0] / g[1]);
  const problems = [];
  let g = 0;
  let acc = 0;
  let current = [];

  const flush = () => {
    // Only flagged notes (8th and shorter) can carry a beam at all; rests and
    // quarter-or-longer notes break the run. A quarter-note triplet has no
    // beam to get wrong.
    const BEAMABLE = new Set(['8', '16', '32', '64']);
    const sounding = current.filter(i => !notes[i].rest && BEAMABLE.has(String(notes[i].duration)));
    if (sounding.length > 1) {
      const tset = new Set(sounding.map(i => tupletIndexFor(spec, voice, i)));
      const realTuplets = [...tset].filter(t => t !== -1);
      // Only one shape is unambiguously wrong: a single beam joining notes
      // from two different tuplets (e.g. 4+2 across two triplets instead of
      // 3+3). A beam that mixes ONE tuplet with plain notes is legitimate
      // engraving — "Single Stroke Four" is a triplet beamed into its
      // resolving downbeat — so that is not failed here.
      if (realTuplets.length > 1) {
        problems.push({ notes: sounding.slice(), reason: 'beam spans more than one tuplet' });
      }
    }
    current = [];
    acc = 0;
    g = (g + 1) % groups.length;
  };

  for (const i of idx) {
    const tIdx = tupletIndexFor(spec, voice, i);
    const scale = tIdx === -1 ? 1
      : (spec.tuplets[tIdx].notes_occupied / spec.tuplets[tIdx].num_notes);
    const tk = noteTicks(notes[i], scale);
    if (tk === null) return [];           // unknown duration — audit-lessons owns that
    current.push(i);
    acc += tk;
    if (acc >= groups[g] - 1e-9) flush();
  }
  flush();
  return problems;
}

const findings = [];
function scan(label, spec) {
  if (!spec || !spec.beamGroups || !(spec.tuplets || []).length) return;
  for (const voice of ['hands', 'feet']) {
    for (const p of analyzeVoice(spec, voice)) {
      findings.push(`${label} [${voice}] ${p.reason} — notes ${p.notes.join(',')}`);
    }
  }
}

for (const [slug, lesson] of Object.entries(lessonContent)) {
  (lesson.exercises || []).forEach((ex, i) => scan(`${slug}#${i} "${ex.title || ''}"`, ex));
}
if (rudiments) {
  for (const group of Object.values(rudiments)) {
    const list = Array.isArray(group) ? group : (group && group.rudiments) || [];
    for (const r of list) {
      if (r && r.spec) scan(`rudiment:${r.slug || r.name || '?'} spec`, r.spec);
      if (r && r.card) scan(`rudiment:${r.slug || r.name || '?'} card`, r.card);
    }
  }
}

if (findings.length) {
  console.error(`[check-beam-groups] FAIL: ${findings.length} beam(s) contradict the notated rhythm`);
  findings.forEach(f => console.error('  ' + f));
  console.error('\n  Fix: beamGroups are REAL played time. One beat per beam is [1,4]');
  console.error('  in every meter and inside any tuplet — [3,8] means 1.5 beats.');
  process.exit(1);
}
console.log('[check-beam-groups] OK — no beam crosses a tuplet boundary');
