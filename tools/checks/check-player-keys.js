// tools/checks/check-player-keys.js
// Every distinct VexFlow key used by any exercise voice must map to a player
// drum voice in KEY_TO_DRUM (src/assets/js/player.js). Exit 0 = full coverage.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const lessonContent = require(path.join(ROOT, 'src/_data/lessonContent.js'));
const playerSrc = fs.readFileSync(path.join(ROOT, 'src/assets/js/player.js'), 'utf8');

const mapMatch = /KEY_TO_DRUM\s*=\s*\{([\s\S]*?)\}/.exec(playerSrc);
if (!mapMatch) { console.error('[check-player-keys] FAIL: KEY_TO_DRUM not found in player.js'); process.exit(1); }
const mapped = new Set([...mapMatch[1].matchAll(/'([^']+)'\s*:/g)].map(m => m[1]));

const used = new Map();
for (const lesson of Object.values(lessonContent)) {
  for (const ex of lesson.exercises || []) {
    for (const voice of ['hands', 'feet']) {
      for (const note of ex[voice] || []) {
        if (note.rest) continue;
        for (const k of note.keys || []) used.set(k, (used.get(k) || 0) + 1);
      }
    }
  }
}

const missing = [...used.keys()].filter(k => !mapped.has(k)).sort();
if (missing.length) {
  console.error('[check-player-keys] FAIL: unmapped drum keys (silent on playback):');
  missing.forEach(k => console.error(`  ${k}  (${used.get(k)} hits)`));
  process.exit(1);
}
console.log(`[check-player-keys] OK — all ${used.size} distinct keys mapped`);
