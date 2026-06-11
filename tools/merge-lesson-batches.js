// Merger: takes batch files in tools/lesson-batches/*.js (each a `module.exports = { ... };`)
// and inlines their entries into src/_data/lessonContent.js, just before the closing `};`.
// Each batch becomes a banner-commented section. Re-running is idempotent — banners are
// keyed by batch filename so duplicate inserts are detected and skipped.

const fs = require('fs');
const path = require('path');

const BATCH_DIR = path.join(__dirname, 'lesson-batches');
const TARGET    = path.join(__dirname, '..', 'src', '_data', 'lessonContent.js');

function batchBody(srcText) {
  // Anchor on `module.exports = {` so leading file-header comments containing
  // `{` or `}` characters don't confuse the slice. The closing brace we want
  // is the one that matches that opening — find it by depth-counting from the
  // anchor onward, ignoring braces inside string/template literals or comments.
  const anchorRe = /module\.exports\s*=\s*\{/;
  const m = anchorRe.exec(srcText);
  if (!m) throw new Error('Could not find `module.exports = {` in batch');
  const start = m.index + m[0].length;
  let depth = 1;
  let i = start;
  let inLine = false, inBlock = false, inSingle = false, inDouble = false, inTemplate = false;
  while (i < srcText.length && depth > 0) {
    const c = srcText[i], n = srcText[i + 1];
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
  if (depth !== 0) throw new Error('Unbalanced braces in batch object literal');
  return srcText.slice(start, i).trim();
}

function bannerFor(name) {
  return `  // ============================================================\n  // BATCH: ${name}\n  // ============================================================`;
}

function main() {
  if (!fs.existsSync(BATCH_DIR)) { console.error('No batch dir'); process.exit(1); }
  const batches = fs.readdirSync(BATCH_DIR).filter(f => f.endsWith('.js')).sort();
  if (!batches.length) { console.log('No batches to merge.'); return; }

  let target = fs.readFileSync(TARGET, 'utf8');
  let inserted = 0; let skipped = 0;

  for (const fn of batches) {
    const banner = bannerFor(fn);
    if (target.includes(`BATCH: ${fn}`)) { skipped++; continue; }
    const src = fs.readFileSync(path.join(BATCH_DIR, fn), 'utf8');
    const body = batchBody(src);

    // Insert before final `};` of target
    const closeIdx = target.lastIndexOf('};');
    if (closeIdx < 0) throw new Error('Could not find closing `};` in target');

    // Make sure we leave a comma after the last existing entry
    let pre = target.slice(0, closeIdx);
    pre = pre.replace(/}\s*\n\s*$/, '},\n\n');

    const insertion = `${banner}\n  ${body}\n\n`;
    target = pre + insertion + target.slice(closeIdx);
    inserted++;
    console.log('Merged:', fn);
  }
  fs.writeFileSync(TARGET, target);
  console.log(`Done. Inserted ${inserted}, skipped ${skipped} (already present).`);

  // Validate that the result is loadable
  delete require.cache[require.resolve(TARGET)];
  const all = require(TARGET);
  console.log(`Validated: ${Object.keys(all).length} total lessons in lessonContent.js`);
}

main();
