// tools/audit-site.js
// Site-wide metrics engine + regression gate for the improvement loop.
// Read-only over src/ and _site/; writes only the baseline (and only with --write-baseline).
//
// Usage:
//   node tools/audit-site.js                   human report (always exit 0)
//   node tools/audit-site.js --json            stable JSON to stdout
//   node tools/audit-site.js --write-baseline  write tools/audit-site-baseline.json (no shell redirect → no BOM)
//   node tools/audit-site.js --gate            exit 1 if any metric regressed vs the baseline
//   Flags: --source-only (skip _site DOM phase), --allow-slug-change (gate: permit integrity.lessonSlugHash change)
//
// Gate rules by key namespace:
//   info.*       never gated (context numbers)
//   integrity.*  ANY change fails (these must stay constant unless deliberately re-baselined)
//   everything else: an INCREASE fails; decreases are progress; keys new to the baseline are informational

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const SITE = path.join(ROOT, '_site');
const BASELINE_PATH = path.join(__dirname, 'audit-site-baseline.json');

const args = new Set(process.argv.slice(2));
const metrics = {};
const details = {}; // key -> [detail lines], capped at 20 in the report

function add(key, value, detailLines) {
  metrics[key] = value;
  if (detailLines && detailLines.length) details[key] = detailLines.slice(0, 20);
}

// ---------------------------------------------------------------- SOURCE phase

const lessonContent = require(path.join(ROOT, 'src/_data/lessonContent.js'));
const curriculum = require(path.join(ROOT, 'src/_data/curriculum.js'));
const playerSrc = fs.readFileSync(path.join(ROOT, 'src/assets/js/player.js'), 'utf8');
const cssSrc = fs.readFileSync(path.join(ROOT, 'src/assets/css/style.css'), 'utf8');
const contentRaw = fs.readFileSync(path.join(ROOT, 'src/_data/lessonContent.js'), 'utf8');

const lessons = Object.entries(lessonContent);

// --- player: drum-key coverage -------------------------------------------
const keyMapMatch = /KEY_TO_DRUM\s*=\s*\{([\s\S]*?)\}/.exec(playerSrc);
const mappedKeys = new Set();
if (keyMapMatch) {
  for (const m of keyMapMatch[1].matchAll(/'([^']+)'\s*:/g)) mappedKeys.add(m[1]);
}
const keyUsage = new Map(); // key -> hit count
for (const [, lesson] of lessons) {
  for (const ex of lesson.exercises || []) {
    for (const voice of ['hands', 'feet']) {
      for (const note of ex[voice] || []) {
        if (note.rest) continue;
        for (const k of note.keys || []) keyUsage.set(k, (keyUsage.get(k) || 0) + 1);
      }
    }
  }
}
const unmapped = [...keyUsage.keys()].filter(k => !mappedKeys.has(k)).sort();
add('player.unmappedDrumKeys', unmapped.length, unmapped.map(k => `${k} (${keyUsage.get(k)} hits)`));
add('player.silentHits', unmapped.reduce((s, k) => s + keyUsage.get(k), 0));

// --- player: multi-bar support --------------------------------------------
// Tick math comes from the shared module the player itself uses.
const PatternMath = require(path.join(ROOT, 'src/assets/js/pattern-math.js'));
const voiceTicks = (ex, voice) => PatternMath.voiceTicks(ex, voice);
const playerHandlesMultiBar = /PatternMath\.patternDurationSecs/.test(playerSrc);
const multiBar = [];
for (const [slug, lesson] of lessons) {
  (lesson.exercises || []).forEach((ex, i) => {
    if (!ex.timeSignature) return;
    const [num, den] = ex.timeSignature.split('/').map(Number);
    const expected = ex.expectedBeats || num * (4 / den);
    for (const voice of ['hands', 'feet']) {
      if (!(ex[voice] || []).length) continue;
      const ticks = voiceTicks(ex, voice);
      if (ticks === null) continue;
      const ratio = ticks / expected;
      if (ratio > 1.01 && Math.abs(ratio - Math.round(ratio)) < 0.01) {
        multiBar.push(`${slug}#${i}`);
        return; // count each exercise once
      }
    }
  });
}
add('player.multiBarSpecsUnsupported', playerHandlesMultiBar ? 0 : multiBar.length,
  playerHandlesMultiBar ? [] : multiBar);

// --- metadata vocabulary ---------------------------------------------------
const focusValues = new Set(lessons.map(([, l]) => l.focus).filter(Boolean));
add('meta.focusDistinctValues', focusValues.size, [...focusValues].sort());

const durationShapes = new Map();
for (const [slug, l] of lessons) {
  if (!l.duration) continue;
  const shape = l.duration.replace(/\d+/g, 'N');
  if (!durationShapes.has(shape)) durationShapes.set(shape, slug);
}
add('meta.durationFormats', durationShapes.size,
  [...durationShapes.entries()].sort().map(([s, slug]) => `"${s}" e.g. ${slug}`));

function titleScheme(t) {
  if (/^\d+[A-Za-z]\s*—/.test(t)) return 'numletter-dash';
  if (/^\d+\s*—/.test(t)) return 'num-dash';
  if (/^\D.*?\d+\s*—/.test(t)) return 'word-num-dash';
  if (/—/.test(t)) return 'other-dash';
  return 'no-dash';
}
const schemes = new Map();
for (const [slug, l] of lessons) {
  for (const ex of l.exercises || []) {
    if (!ex.title) continue;
    const s = titleScheme(ex.title);
    if (!schemes.has(s)) schemes.set(s, `${slug}: "${ex.title}"`);
  }
}
add('meta.titleNumberingSchemes', schemes.size,
  [...schemes.entries()].sort().map(([s, eg]) => `${s} e.g. ${eg}`));

const tempoMismatches = [];
for (const [slug, l] of lessons) {
  (l.exercises || []).forEach((ex, i) => {
    const m = /♩\s*=\s*(\d+)\s*(?:→|->|–|—)\s*(\d+)/.exec(ex.meta || '');
    if (m && Number(m[1]) !== ex.bpm) tempoMismatches.push(`${slug}#${i} meta ♩=${m[1]}→${m[2]} but bpm=${ex.bpm}`);
  });
}
add('meta.tempoRangeMetaMismatches', tempoMismatches.length, tempoMismatches);

// --- content shape ---------------------------------------------------------
const thin = [], noSub = [], fewEx = [], zeroEx = [], noListen = [];
for (const [slug, l] of lessons) {
  const pCount = ((l.bodyHtml || '').match(/<p[\s>]/g) || []).length;
  if (pCount <= 2) thin.push(`${slug} (${pCount} <p>)`);
  if (!/<h[23][\s>]/.test(l.bodyHtml || '')) noSub.push(slug);
  const exCount = (l.exercises || []).length;
  if (exCount === 0) zeroEx.push(slug);
  if (exCount <= 2) fewEx.push(`${slug} (${exCount})`);
  if (!(l.listening || []).length) noListen.push(slug);
}
add('content.lessonsThinProse', thin.length, thin);
add('content.lessonsNoSubheadings', noSub.length, noSub);
add('content.lessonsFewExercises', fewEx.length, fewEx);
add('content.lessonsZeroExercises', zeroEx.length, zeroEx);
add('content.lessonsMissingListening', noListen.length, noListen);

const BRITISH = /\b(practis(?:e|es|ed|ing)|colour(?:s|ful|ed|ing)?|centre(?:s|d)?|centring|internalis(?:e|es|ed|ing|ation)|emphasis(?:e|es|ed|ing)|realis(?:e|es|ed|ing)|organis(?:e|es|ed|ing|ation|ations)|favour(?:s|ed|ing|ite|ites)?|analys(?:e|ed|ing)|minimis(?:e|es|ed|ing)|maximis(?:e|es|ed|ing)|recognis(?:e|es|ed|ing)|memoris(?:e|es|ed|ing)|synchronis(?:e|es|ed|ing)|stabilis(?:e|es|ed|ing)|whilst)\b/gi;
const britishHits = contentRaw.match(BRITISH) || [];
const britishByWord = new Map();
for (const w of britishHits) {
  const lw = w.toLowerCase();
  britishByWord.set(lw, (britishByWord.get(lw) || 0) + 1);
}
add('content.britishSpellings', britishHits.length,
  [...britishByWord.entries()].sort((a, b) => b[1] - a[1]).map(([w, n]) => `${w} x${n}`));

const pickCount = new Map(); // "artist — work" -> lesson count
for (const [, l] of lessons) {
  const seen = new Set();
  for (const item of l.listening || []) {
    const k = `${item.artist} — ${item.work}`;
    if (seen.has(k)) continue;
    seen.add(k);
    pickCount.set(k, (pickCount.get(k) || 0) + 1);
  }
}
const dupPicks = [...pickCount.entries()].filter(([, n]) => n > 3).sort((a, b) => b[1] - a[1]);
add('content.duplicateListeningPicks', dupPicks.length, dupPicks.map(([k, n]) => `${k} in ${n} lessons`));

// --- css -------------------------------------------------------------------
add('css.pxFontSizes', (cssSrc.match(/font-size:\s*[\d.]+px/g) || []).length);
add('css.outlineNone', (cssSrc.match(/outline:\s*none/g) || []).length);
add('css.missingFocusVisible', /:focus-visible/.test(cssSrc) ? 0 : 1);
add('css.missingReducedMotion', /prefers-reduced-motion/.test(cssSrc) ? 0 : 1);
add('css.missingDarkScheme', /prefers-color-scheme/.test(cssSrc) ? 0 : 1);

// --- hygiene: known dead feature paths --------------------------------------
const njkFiles = [];
(function walkNjk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkNjk(p);
    else if (e.name.endsWith('.njk')) njkFiles.push(p);
  }
})(path.join(ROOT, 'src'));
const njkAll = njkFiles.map(p => ({ p, text: fs.readFileSync(p, 'utf8') }));
const dead = [];
if (njkAll.some(f => f.text.includes('preview-card'))) dead.push('index.njk preview-card block (previewExercise defined on 0 lessons)');
if (fs.existsSync(path.join(ROOT, 'src/_includes/lesson.njk'))) dead.push('src/_includes/lesson.njk (deprecated layout)');
if (njkAll.some(f => /\b(lesson|l)\.status\s*\}\}/.test(f.text))) dead.push('status badge rendered (all 217 lessons are ready)');
if (curriculum.generalistPath && !njkAll.some(f => f.text.includes('generalistPath'))) dead.push('curriculum.generalistPath rendered by no template');
add('hygiene.deadFeatureRefs', dead.length, dead);

// --- integrity (gate: must not change) ---------------------------------------
const currSlugs = new Set();
curriculum.foundations.sections.forEach(s => s.lessons.forEach(l => currSlugs.add(l.slug)));
curriculum.tracks.forEach(t => t.levels.forEach(lv => lv.lessons.forEach(l => currSlugs.add(l.slug))));
curriculum.mastery.lessons.forEach(l => currSlugs.add(l.slug));
const contentSlugs = new Set(Object.keys(lessonContent));
const allSlugs = new Set([...currSlugs, ...contentSlugs]);

const dangling = [];
for (const [slug, l] of lessons) {
  for (const field of ['prerequisites', 'nextLessons']) {
    for (const ref of l[field] || []) {
      if (!allSlugs.has(ref)) dangling.push(`${slug}.${field} → ${ref}`);
    }
  }
}
add('integrity.danglingRefs', dangling.length, dangling);

const missingContent = [...currSlugs].filter(s => !contentSlugs.has(s)).sort();
const orphanContent = [...contentSlugs].filter(s => !currSlugs.has(s)).sort();
add('integrity.contentCurriculumMismatch', missingContent.length + orphanContent.length,
  [...missingContent.map(s => `curriculum without content: ${s}`),
   ...orphanContent.map(s => `content without curriculum: ${s}`)]);

add('integrity.lessonSlugHash',
  crypto.createHash('sha1').update([...contentSlugs].sort().join('\n')).digest('hex').slice(0, 12));

// --- info (never gated) -------------------------------------------------------
add('info.lessonCount', lessons.length);
add('info.exerciseCount', lessons.reduce((s, [, l]) => s + (l.exercises || []).length, 0));
add('info.listeningEntries', lessons.reduce((s, [, l]) => s + (l.listening || []).length, 0));

// ---------------------------------------------------------------- DOM phase

if (!args.has('--source-only')) {
  if (!fs.existsSync(SITE)) {
    console.error('[audit-site] _site/ not found — DOM metrics skipped (run npm run build, or pass --source-only to silence this)');
  } else {
    const htmlFiles = [];
    (function walk(dir) {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (path.relative(SITE, p).split(path.sep)[0] === 'dev') continue; // dev-server-only pages
          walk(p);
        } else if (e.name.endsWith('.html')) htmlFiles.push(p);
      }
    })(SITE);

    let missingMain = [], missingSkip = [], svgNoAria = 0;
    for (const f of htmlFiles) {
      const html = fs.readFileSync(f, 'utf8');
      const rel = path.relative(SITE, f).replace(/\\/g, '/');
      if (!/<main[\s>]/.test(html)) missingMain.push(rel);
      if (!html.includes('class="skip-link"')) missingSkip.push(rel);
      svgNoAria += (html.match(/<svg(?![^>]*\brole=)[^>]*>/g) || []).length;
    }
    add('dom.pagesMissingMain', missingMain.length, missingMain);
    add('dom.pagesMissingSkipLink', missingSkip.length, missingSkip);
    add('dom.svgsMissingAria', svgNoAria);
    add('info.pageCount', htmlFiles.length);

    const sitemapPath = path.join(SITE, 'sitemap.xml');
    if (fs.existsSync(sitemapPath)) {
      const sm = fs.readFileSync(sitemapPath, 'utf8');
      add('dom.relativeSitemapLocs', (sm.match(/<loc>(?!https?:)/g) || []).length);
    } else {
      add('dom.relativeSitemapLocs', 0);
    }

    // Heading-order sample: first 10 lesson pages alphabetically (deterministic).
    const lessonsDir = path.join(SITE, 'lessons');
    if (fs.existsSync(lessonsDir)) {
      const { JSDOM } = require('jsdom');
      const sample = fs.readdirSync(lessonsDir).sort().slice(0, 10)
        .map(d => path.join(lessonsDir, d, 'index.html'))
        .filter(p => fs.existsSync(p));
      const violations = [];
      for (const p of sample) {
        const rel = path.relative(SITE, p).replace(/\\/g, '/');
        const dom = new JSDOM(fs.readFileSync(p, 'utf8'));
        const hs = [...dom.window.document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
          .map(h => Number(h.tagName[1]));
        if (hs.filter(l => l === 1).length !== 1) violations.push(`${rel}: ${hs.filter(l => l === 1).length} h1s`);
        for (let i = 1; i < hs.length; i++) {
          if (hs[i] - hs[i - 1] > 1) { violations.push(`${rel}: h${hs[i - 1]} → h${hs[i]}`); break; }
        }
      }
      add('dom.headingOrderViolations', violations.length, violations);
    }
  }
}

// ---------------------------------------------------------------- output / gate

const sortedKeys = Object.keys(metrics).sort();

if (args.has('--json') || args.has('--write-baseline')) {
  const out = {};
  for (const k of sortedKeys) out[k] = metrics[k];
  const json = JSON.stringify({ metrics: out }, null, 2) + '\n';
  if (args.has('--write-baseline')) {
    fs.writeFileSync(BASELINE_PATH, json, 'utf8');
    console.log(`[audit-site] baseline written: ${path.relative(ROOT, BASELINE_PATH)} (${sortedKeys.length} metrics)`);
  } else {
    process.stdout.write(json);
  }
  process.exit(0);
}

if (args.has('--gate')) {
  if (!fs.existsSync(BASELINE_PATH)) {
    console.error('[audit-site] GATE FAIL: no baseline. Run: node tools/audit-site.js --write-baseline');
    process.exit(1);
  }
  const baseline = JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8').replace(/^﻿/, '')).metrics;
  const failures = [];
  for (const k of sortedKeys) {
    if (k.startsWith('info.')) continue;
    if (!(k in baseline)) { console.error(`[audit-site] note: new metric ${k}=${metrics[k]} (not in baseline, not gated)`); continue; }
    if (k.startsWith('integrity.')) {
      if (metrics[k] !== baseline[k] && !(k === 'integrity.lessonSlugHash' && args.has('--allow-slug-change'))) {
        failures.push(`${k}: ${baseline[k]} → ${metrics[k]} (integrity keys must not change)`);
      }
    } else if (typeof metrics[k] === 'number' && metrics[k] > baseline[k]) {
      failures.push(`${k}: ${baseline[k]} → ${metrics[k]} (increased)`);
    }
  }
  for (const k of Object.keys(baseline)) {
    if (!(k in metrics) && !k.startsWith('info.')) console.error(`[audit-site] note: baseline metric ${k} missing from current run`);
  }
  if (failures.length) {
    console.error('[audit-site] GATE FAIL:');
    failures.forEach(f => console.error('  ' + f));
    process.exit(1);
  }
  console.log(`[audit-site] gate OK (${sortedKeys.length} metrics, no regressions)`);
  process.exit(0);
}

// Human report
console.log('=== audit-site metrics ===');
for (const k of sortedKeys) console.log(`${k}: ${metrics[k]}`);
for (const k of sortedKeys) {
  if (!details[k] || !details[k].length) continue;
  console.log(`\n--- ${k} (${metrics[k]}) ---`);
  details[k].forEach(d => console.log('  ' + d));
  const total = Array.isArray(details[k]) ? metrics[k] : 0;
  if (typeof metrics[k] === 'number' && metrics[k] > details[k].length) {
    console.log(`  … and more (showing ${details[k].length})`);
  }
}
