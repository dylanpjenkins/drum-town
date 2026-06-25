// .eleventy.js
const { renderPattern } = require('./tools/notation-renderer');

// DEV TOOLING — review dashboard backend. Delete the next line and the
// setBrowserSyncConfig block below to remove the dashboard.
const { reviewMiddleware } = require('./tools/review-middleware');

const { getPostHogClient } = require('./src/posthog');

module.exports = function (eleventyConfig) {
  // Pass-through for static assets
  eleventyConfig.addPassthroughCopy({ 'src/assets': 'assets' });

  // DEV TOOLING — mount the /dev/review/status API into the dev server so
  // `npm start` serves both the site and the review state on one port.
  eleventyConfig.setServerOptions({
    middleware: [reviewMiddleware]
  });

  // The review dashboard is dev-server-only; keep src/dev/ out of one-off
  // production builds so internal tooling never ships in _site.
  if (process.env.ELEVENTY_RUN_MODE === 'build') {
    eleventyConfig.ignores.add('src/dev/**');
  }

  // Shortcode: render a notation pattern inline
  eleventyConfig.addShortcode('notation', function (specJson) {
    const spec = typeof specJson === 'string' ? JSON.parse(specJson) : specJson;
    return renderPattern(spec);
  });

  // Shortcode: full exercise block (title + meta + notation + tip).
  // If the spec includes a `bpm` field, also embed a play button carrying
  // a JSON copy of the audio-relevant fields for the client-side player.
  function escapeAttr(s) {
    return s.replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;');
  }
  eleventyConfig.addShortcode('exercise', function (ex) {
    const spec = typeof ex === 'string' ? JSON.parse(ex) : ex;
    const svg = renderPattern(spec);
    const tipBlock = spec.tip
      ? `<div class="exercise-tip">${spec.tip}</div>`
      : '';
    let controls = '';
    if (spec.bpm) {
      const audioSpec = {
        bpm: spec.bpm,
        timeSignature: spec.timeSignature,
        repeatBegin: spec.repeatBegin,
        repeatEnd: spec.repeatEnd,
        hands: spec.hands,
        feet: spec.feet,
        tuplets: spec.tuplets
      };
      const data = escapeAttr(JSON.stringify(audioSpec));
      controls = `
        <div class="exercise-controls">
          <select class="kit-selector__select" data-exercise-kit aria-label="Drum kit sound">
            <option value="electronic">Electronic</option>
            <option value="acoustic">Acoustic</option>
          </select>
          <button class="play-btn" type="button" data-exercise-play data-spec="${data}" aria-label="Play exercise"><span class="play-btn__icon" aria-hidden="true">▶</span><span class="play-btn__label">Play</span></button>
        </div>`;
    }
    return `
      <div class="exercise">
        <div class="exercise-header">
          <div class="exercise-header__text">
            <div class="exercise-title">${spec.title || 'Exercise'}</div>
            ${spec.meta ? `<div class="exercise-meta">${spec.meta}</div>` : ''}
          </div>
          ${controls}
        </div>
        <div class="notation">${svg}</div>
        ${tipBlock}
      </div>
    `;
  });

  // Foundations is now sectioned; this helper returns its lessons flattened
  // with subsection metadata attached, so existing slug-lookup paths keep
  // working without caring about subsection structure.
  function flattenFoundations(curriculum) {
    return curriculum.foundations.sections.flatMap(s =>
      s.lessons.map(l => ({
        ...l,
        section: 'foundations',
        subSection: s.slug,
        subSectionTitle: s.title
      }))
    );
  }

  // Filter: find a track by slug
  eleventyConfig.addFilter('findTrack', function (curriculum, slug) {
    return curriculum.tracks.find(t => t.slug === slug);
  });

  // Filter: find a lesson by slug across the entire curriculum
  eleventyConfig.addFilter('findLesson', function (curriculum, slug) {
    const all = [
      ...flattenFoundations(curriculum),
      ...curriculum.tracks.flatMap(t =>
        t.levels.flatMap(lv =>
          lv.lessons.map(l => ({ ...l, section: 'track', track: t.slug, trackTitle: t.title, level: lv.level, levelTitle: lv.title }))
        )
      ),
      ...curriculum.mastery.lessons.map(l => ({ ...l, section: 'mastery' }))
    ];
    return all.find(l => l.slug === slug);
  });

  // Filter: count of all lessons
  eleventyConfig.addFilter('lessonCount', function (curriculum) {
    return curriculum.foundations.sections.reduce((sum, s) => sum + s.lessons.length, 0)
      + curriculum.tracks.reduce((sum, t) => sum + t.levels.reduce((s, lv) => s + lv.lessons.length, 0), 0)
      + curriculum.mastery.lessons.length;
  });

  // Collection: flat list of all lessons across foundations + tracks + mastery
  eleventyConfig.addCollection('allLessons', function () {
    const curriculum = require('./src/_data/curriculum.js');
    return [
      ...flattenFoundations(curriculum),
      ...curriculum.tracks.flatMap(t =>
        t.levels.flatMap(lv =>
          lv.lessons.map(l => ({
            ...l,
            section: 'track',
            track: t.slug,
            trackTitle: t.title,
            level: lv.level,
            levelTitle: lv.title
          }))
        )
      ),
      ...curriculum.mastery.lessons.map(l => ({ ...l, section: 'mastery' }))
    ];
  });

  eleventyConfig.addFilter('readyCount', function (curriculum) {
    let n = 0;
    curriculum.foundations.sections.forEach(s => s.lessons.forEach(l => { if (l.status === 'ready') n++; }));
    curriculum.tracks.forEach(t => t.levels.forEach(lv => lv.lessons.forEach(l => { if (l.status === 'ready') n++; })));
    curriculum.mastery.lessons.forEach(l => { if (l.status === 'ready') n++; });
    return n;
  });

  // Zero-pad an integer to two digits for chapter-lesson labels (01, 02 ... 14).
  eleventyConfig.addFilter('pad2', n => String(n).padStart(2, '0'));

  // Flatten a track's levels into a single ordered lesson array — used on the
  // homepage where each track renders as one chapter rather than per-level.
  eleventyConfig.addFilter('flatTrackLessons', track =>
    (track.levels || []).flatMap(lv => lv.lessons || [])
  );

  eleventyConfig.on('eleventy.after', async ({ results }) => {
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: 'build',
      event: 'build_completed',
      properties: {
        outputCount: results.length,
        runMode: process.env.ELEVENTY_RUN_MODE || 'unknown',
      },
    });
    await posthog.shutdown();
  });

  // Serialize a value as JSON safe for embedding inside an inline <script> tag.
  // Escapes the `</` sequence so a stray "</script>" in any string can't close
  // the parent tag.
  eleventyConfig.addFilter('inlineJson', v =>
    JSON.stringify(v).replace(/</g, '\\u003c')
  );

  return {
    dir: {
      input: 'src',
      includes: '_includes',
      data: '_data',
      output: '_site'
    },
    templateFormats: ['njk', 'md', 'html'],
    htmlTemplateEngine: 'njk',
    markdownTemplateEngine: 'njk'
  };
};
