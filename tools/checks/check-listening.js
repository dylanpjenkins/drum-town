// tools/checks/check-listening.js
// Listening entries are { artist, work, note } where:
//   artist — the DRUMMER (that is the whole point of the section)
//   work   — "Credited Act — Title" when the record is credited to someone
//            other than the drummer; bare "Title" when the drummer IS the
//            credited artist; a parenthetical carries medium or context
//            ("(live)", "(book)", "(Kind of Blue)")
//   note   — what to listen FOR, a finished sentence
//
// The shape of `work` is deliberately conditional, not uniform: flattening
// "Stevie Wonder / Superstition" into a band-dash form would invent a band,
// and "Gary Chester / The New Breed (book)" is not a recording at all. What
// this gate gets to enforce is the parts that are unambiguously wrong.
// Exit 0 = clean.

const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const lessonContent = require(path.join(ROOT, 'src/_data/lessonContent.js'));

const findings = [];
let checked = 0;

for (const [slug, lesson] of Object.entries(lessonContent)) {
  (lesson.listening || []).forEach((e, i) => {
    checked++;
    const at = `${slug}#${i}`;
    if (!e.artist || !e.work || !e.note) {
      findings.push(`${at}: missing artist, work or note`);
      return;
    }
    // The drummer goes in `artist`; a leading article means a band slipped in.
    if (/^(the|a)\s/i.test(e.artist)) {
      findings.push(`${at}: artist "${e.artist}" looks like a band — put the drummer here and the act in work`);
    }
    if (e.artist !== e.artist.trim() || e.work !== e.work.trim()) {
      findings.push(`${at}: leading/trailing whitespace in artist or work`);
    }
    // One separator style, so the field reads consistently wherever it is
    // used: an em dash with single spaces.
    if (/\s-\s|\s–\s/.test(e.work)) {
      findings.push(`${at}: work uses a hyphen/en dash as separator — use " — " ("${e.work}")`);
    }
    if (!/[.!?]$/.test(e.note.trim())) {
      findings.push(`${at}: note is not a finished sentence ("…${e.note.trim().slice(-40)}")`);
    }
    if (e.note.trim().length < 25) {
      findings.push(`${at}: note is too short to say what to listen for ("${e.note}")`);
    }
  });
}

if (findings.length) {
  console.error(`[check-listening] FAIL: ${findings.length} listening entry problem(s)`);
  findings.slice(0, 30).forEach(f => console.error('  ' + f));
  if (findings.length > 30) console.error(`  … and ${findings.length - 30} more`);
  process.exit(1);
}
console.log(`[check-listening] OK — all ${checked} listening entries well-formed`);
