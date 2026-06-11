// Flip curriculum.js statuses to 'ready' for every slug that has full content in
// lessonContent.js. Stays in lockstep with whatever the merger has produced.

const fs = require('fs');
const path = require('path');

const CURRICULUM = path.join(__dirname, '..', 'src', '_data', 'curriculum.js');
const CONTENT    = path.join(__dirname, '..', 'src', '_data', 'lessonContent.js');

const content = require(CONTENT);
const readySlugs = new Set(Object.keys(content));

let src = fs.readFileSync(CURRICULUM, 'utf8');

// Replace `slug: "<slug>", title: "...", status: "stub"` with `status: "ready"`
// for every slug now in content. Curriculum lines look like:
//   { slug: "the-drum-kit", title: "The Kit: What's What", status: "stub" }
let flipped = 0;
// Lesson entries are one-line (slug + title + status); section entries span lines.
// Restrict the lazy match to a single line so we don't accidentally match a section.
src = src.replace(/(\{\s*slug:\s*"([^"]+)"[^}\n]*?status:\s*)"stub"/g, (m, prefix, slug) => {
  if (readySlugs.has(slug)) { flipped++; return prefix + '"ready"'; }
  return m;
});

fs.writeFileSync(CURRICULUM, src);
console.log(`Flipped ${flipped} slugs to ready.`);
console.log(`Total slugs in lessonContent: ${readySlugs.size}`);

// Sanity: count remaining stubs
const stubs = (src.match(/status:\s*"stub"/g) || []).length;
const readys = (src.match(/status:\s*"ready"/g) || []).length;
console.log(`Curriculum now: ${readys} ready, ${stubs} stub`);
