// tools/checks/check-exercise-titles.js
// Exercise titles follow one scheme (docs/content-style-guide.md):
//   "N — Title", or "NA / NB — Title" for consecutive variations of the same
//   exercise, where N is the exercise's position in the lesson. A lesson may
//   instead use a named sequence ("Round 1 — …", "Pattern A — …") but then
//   EVERY exercise in it must, and its prose usually cites those labels.
//
// The failure this exists to prevent is a lesson numbering two different
// exercises the same, which happened mid-normalisation at iter 34 when three
// titles containing escaped quotes silently failed to match.
// Exit 0 = clean.

const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const lessonContent = require(path.join(ROOT, 'src/_data/lessonContent.js'));

const NUMLETTER = /^(\d+)([A-Za-z])\s+—\s+\S/;
const CANON = /^(\d+)\s+—\s+\S/;
const NAMED = /^((?:Build-Up|Round|Pattern|Stage|Step)\s+[\w]+)\s+—\s+\S/i;

const findings = [];
let checked = 0;

for (const [slug, lesson] of Object.entries(lessonContent)) {
  const exs = lesson.exercises || [];
  if (!exs.length) continue;

  const named = exs.filter(e => NAMED.test(e.title || '')).length;
  if (named) {
    // Named sequences are allowed, but must be used consistently.
    if (named !== exs.length) {
      findings.push(`${slug}: mixes a named sequence with numbered titles (${named}/${exs.length} named)`);
    }
    checked += exs.length;
    continue;
  }

  const seen = new Map();
  exs.forEach((ex, i) => {
    checked++;
    const t = ex.title || '';
    const nl = NUMLETTER.exec(t);
    const cn = CANON.exec(t);
    if (!nl && !cn) {
      findings.push(`${slug}#${i}: "${t}" does not match "N — Title" or "NA — Title"`);
      return;
    }
    const num = Number((nl || cn)[1]);
    const letter = nl ? nl[2].toUpperCase() : '';
    const key = `${num}${letter}`;
    if (seen.has(key)) {
      findings.push(`${slug}: two exercises both labelled "${key}" (#${seen.get(key)} and #${i})`);
    }
    seen.set(key, i);
    if (num < 1) findings.push(`${slug}#${i}: numbering starts below 1 ("${t}")`);
    // An em dash should separate the number from the title exactly once.
    if ((t.match(/—/g) || []).length > 1) {
      findings.push(`${slug}#${i}: more than one em dash — use a colon inside the title ("${t}")`);
    }
  });

  // Numbers must cover 1..N with no gaps once letters are collapsed.
  const bases = [...new Set([...seen.keys()].map(k => parseInt(k, 10)))].sort((a, b) => a - b);
  bases.forEach((b, idx) => {
    if (b !== idx + 1) findings.push(`${slug}: exercise numbering jumps — got ${bases.join(',')}`);
  });
}

if (findings.length) {
  console.error(`[check-exercise-titles] FAIL: ${findings.length} title problem(s)`);
  [...new Set(findings)].slice(0, 30).forEach(f => console.error('  ' + f));
  process.exit(1);
}
console.log(`[check-exercise-titles] OK — all ${checked} exercise titles follow one scheme`);
