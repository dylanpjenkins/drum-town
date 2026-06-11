// Patch lesson entries in src/_data/lessonContent.js with replacements from
// any tools/lesson-batches/fixes-*.js file. Each fixes file exports an object
// keyed by slug; for every slug present, this script finds the existing entry
// in lessonContent.js and replaces it with the new one.
//
// The replacement is done at the source-text level so we keep formatting
// (template literals, comments, etc.) intact for unaffected lessons.

const fs = require('fs');
const path = require('path');

const BATCH_DIR = path.join(__dirname, 'lesson-batches');
const TARGET    = path.join(__dirname, '..', 'src', '_data', 'lessonContent.js');

// Find the body span of `'slug': { ... }` in source text. Returns {start, end}
// (inclusive of the trailing `}`). Returns null if the slug isn't found.
function findEntrySpan(src, slug) {
  const escaped = slug.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const reKey = new RegExp(`'${escaped}'\\s*:\\s*\\{`);
  const m = reKey.exec(src);
  if (!m) return null;
  const start = m.index;
  // Walk from the `{` after the key to find the matching `}`
  let i = m.index + m[0].length;
  let depth = 1;
  let inLine = false, inBlock = false, inSingle = false, inDouble = false, inTemplate = false;
  while (i < src.length && depth > 0) {
    const c = src[i], n = src[i + 1];
    if (inLine) {
      if (c === '\n') inLine = false;
    } else if (inBlock) {
      if (c === '*' && n === '/') { inBlock = false; i++; }
    } else if (inSingle) {
      if (c === '\\') { i++; }
      else if (c === "'") inSingle = false;
    } else if (inDouble) {
      if (c === '\\') { i++; }
      else if (c === '"') inDouble = false;
    } else if (inTemplate) {
      if (c === '\\') { i++; }
      else if (c === '`') inTemplate = false;
    } else {
      if (c === '/' && n === '/') { inLine = true; i++; }
      else if (c === '/' && n === '*') { inBlock = true; i++; }
      else if (c === "'") inSingle = true;
      else if (c === '"') inDouble = true;
      else if (c === '`') inTemplate = true;
      else if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) break; }
    }
    i++;
  }
  if (depth !== 0) return null;
  return { start, end: i };
}

// Take a fixes file's text, find a single lesson's body, return that lesson's
// JS source (the `'slug': { ... }` block).
function extractEntry(fixesSrc, slug) {
  const span = findEntrySpan(fixesSrc, slug);
  if (!span) return null;
  return fixesSrc.slice(span.start, span.end + 1);
}

function main() {
  if (!fs.existsSync(BATCH_DIR)) { console.error('No batch dir'); process.exit(1); }
  const fixFiles = fs.readdirSync(BATCH_DIR).filter(f => /^fixes-.*\.js$/.test(f)).sort();
  if (!fixFiles.length) { console.log('No fixes-*.js files to apply.'); return; }

  let target = fs.readFileSync(TARGET, 'utf8');
  let totalApplied = 0;

  for (const fn of fixFiles) {
    const fixSrc = fs.readFileSync(path.join(BATCH_DIR, fn), 'utf8');
    const fixModule = require(path.join(BATCH_DIR, fn));
    const slugs = Object.keys(fixModule);
    let applied = 0;
    for (const slug of slugs) {
      const newEntry = extractEntry(fixSrc, slug);
      if (!newEntry) {
        console.log(`  [skip] ${slug} — could not extract entry text from ${fn}`);
        continue;
      }
      const span = findEntrySpan(target, slug);
      if (!span) {
        console.log(`  [skip] ${slug} — not found in lessonContent.js`);
        continue;
      }
      target = target.slice(0, span.start) + newEntry + target.slice(span.end + 1);
      applied++;
    }
    console.log(`Applied ${applied}/${slugs.length} from ${fn}`);
    totalApplied += applied;
  }

  fs.writeFileSync(TARGET, target);
  console.log(`Total slugs patched: ${totalApplied}`);
  // Validate
  delete require.cache[require.resolve(TARGET)];
  const all = require(TARGET);
  console.log(`Validated: ${Object.keys(all).length} total lessons`);
}

main();
