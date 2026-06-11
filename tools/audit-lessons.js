// Audit script — surface lessons that look suspicious for the issues in ISSUES.md.
// Read-only; does not modify lessonContent.js.

const lc = require('../src/_data/lessonContent.js');

function ticksOf(spec, note) {
  const baseLookup = { 'w': 4, 'h': 2, 'q': 1, '8': 0.5, '16': 0.25, '32': 0.125 };
  const base = baseLookup[note.duration];
  if (base === undefined) return null;
  return note.dot ? base * 1.5 : base;
}

function beatsExpected(timeSignature) {
  if (!timeSignature) return null;
  const [num, den] = timeSignature.split('/').map(Number);
  // Express expected duration as "quarter-note units"
  return num * (4 / den);
}

function tupletsContainingIndex(tuplets, voice, idx) {
  return (tuplets || []).filter(t => t.voice === voice && idx >= t.start && idx < t.start + t.length);
}

function effectiveTickSum(spec, voice) {
  const arr = spec[voice] || [];
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    const note = arr[i];
    const tk = ticksOf(spec, note);
    if (tk === null) return null;
    const tup = tupletsContainingIndex(spec.tuplets, voice, i);
    if (tup.length) {
      const t = tup[0];
      sum += tk * (t.notes_occupied / t.num_notes);
    } else {
      sum += tk;
    }
  }
  return sum;
}

const beatMismatches = [];
const sixNoteIn44 = [];
const claveMatches = [];
const gettingStartedKitPatterns = [];

const GETTING_STARTED = ['the-drum-kit', 'setup-posture', 'stick-grip', 'the-practice-mindset'];

for (const [slug, lesson] of Object.entries(lc)) {
  for (const [i, ex] of (lesson.exercises || []).entries()) {
    if (!ex.timeSignature) continue;
    const expected = beatsExpected(ex.timeSignature);
    const handsTicks = effectiveTickSum(ex, 'hands');
    const feetTicks = effectiveTickSum(ex, 'feet');
    if (handsTicks !== null && Math.abs(handsTicks - expected) > 0.01 && (ex.hands || []).length) {
      beatMismatches.push(`${slug}#${i} hands=${handsTicks} expected=${expected} (${ex.timeSignature})`);
    }
    if (feetTicks !== null && Math.abs(feetTicks - expected) > 0.01 && (ex.feet || []).length) {
      beatMismatches.push(`${slug}#${i} feet=${feetTicks} expected=${expected} (${ex.timeSignature})`);
    }
    // Six-note rudiment in 4/4 — likely should be 6/8 or sextuplets
    if (ex.timeSignature === '4/4' && /paradiddle-diddle|swiss-army|double-paradiddle|six-stroke/.test(slug)) {
      const handHits = (ex.hands || []).filter(n => !n.rest).length;
      // 6 or 12 hits in 4/4 likely needs tuplet treatment
      if (handHits === 6 || handHits === 12 || handHits === 24) {
        sixNoteIn44.push(`${slug}#${i}: ${handHits} hand hits in ${ex.timeSignature}`);
      }
    }
    // Getting Started + kit pattern (has feet + multiple voicings on hands)
    if (GETTING_STARTED.includes(slug)) {
      const hasFeet = (ex.feet || []).some(n => !n.rest);
      const handVoices = new Set((ex.hands || []).filter(n => !n.rest).flatMap(n => n.keys || []));
      if (hasFeet || handVoices.size > 1) {
        gettingStartedKitPatterns.push(`${slug}#${i}: feet=${hasFeet}, hand-voicings=${[...handVoices].join('|')}`);
      }
    }
  }
  // Clave-using lessons (by slug pattern) — flag for visual review
  if (/clave/.test(slug)) {
    claveMatches.push(slug);
  }
}

console.log('=== BEAT-COUNT MISMATCHES (real bugs) ===');
beatMismatches.forEach(s => console.log('  ' + s));
console.log('Total:', beatMismatches.length);
console.log();
console.log('=== 6-NOTE-RUDIMENT-LIKE EXERCISES IN 4/4 (should likely be 6/8 or sextuplets) ===');
sixNoteIn44.forEach(s => console.log('  ' + s));
console.log('Total:', sixNoteIn44.length);
console.log();
console.log('=== GETTING-STARTED LESSONS WITH KIT PATTERNS ===');
gettingStartedKitPatterns.forEach(s => console.log('  ' + s));
console.log('Total:', gettingStartedKitPatterns.length);
console.log();
console.log('=== CLAVE-LESSON SLUGS (visual review) ===');
claveMatches.forEach(s => console.log('  ' + s));
