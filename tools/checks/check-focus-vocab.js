// tools/checks/check-focus-vocab.js
// The focus chip renders on every lesson page as "Focus · X". It was free
// text and had drifted to 144 distinct values across 217 lessons — casing
// collisions ("Triplet feel / Ghost notes" vs "Groove / Triplet Feel /
// Ghost Notes"), order collisions ("Dynamics / Technique" vs "Technique /
// Dynamics") and one-offs ("Speculative / Hybrid / Frontier"). It is now a
// controlled vocabulary; this gate keeps it one.
//
// The list is the contract in docs/content-style-guide.md. Adding a value
// means editing the guide and this file together, deliberately.
// Exit 0 = clean.

const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const lessonContent = require(path.join(ROOT, 'src/_data/lessonContent.js'));

const VOCAB = new Set([
  'Getting Started', 'Reading', 'Counting', 'Rudiments', 'Sticking',
  'Hand Technique', 'Foot Technique', 'Coordination', 'Independence',
  'Time & Feel', 'Pocket & Groove', 'Dynamics', 'Articulation', 'Fills',
  'Phrasing & Form', 'Genre Vocabulary', 'Clave & Bell Patterns',
  'Odd Meters & Polyrhythm', 'Linear Playing', 'Speed & Endurance',
  'Soloing & Improvisation', 'Listening & Analysis', 'Practice Method',
  'Studio & Sound'
]);

const offenders = [];
const missing = [];
const used = new Set();
let checked = 0;

for (const [slug, lesson] of Object.entries(lessonContent)) {
  if (!lesson.focus) { missing.push(slug); continue; }
  checked++;
  if (VOCAB.has(lesson.focus)) { used.add(lesson.focus); continue; }
  offenders.push(`${slug}: "${lesson.focus}"`);
}

if (offenders.length) {
  console.error(`[check-focus-vocab] FAIL: ${offenders.length} lesson(s) use a focus outside the controlled vocabulary`);
  offenders.slice(0, 30).forEach(o => console.error('  ' + o));
  if (offenders.length > 30) console.error(`  … and ${offenders.length - 30} more`);
  console.error('\n  Allowed values (docs/content-style-guide.md):');
  console.error('  ' + [...VOCAB].join(' · '));
  process.exit(1);
}

console.log(`[check-focus-vocab] OK — all ${checked} lesson focus values are in the ${VOCAB.size}-value vocabulary (${used.size} in use)`);
if (missing.length) console.log(`  note: ${missing.length} lesson(s) have no focus set: ${missing.slice(0, 5).join(', ')}`);
