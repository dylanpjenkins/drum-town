// .eleventy.js
const { renderPattern } = require('./tools/notation-renderer');

// DEV TOOLING — review dashboard backend. Delete the next line and the
// setServerOptions block below to remove the dashboard.
const { reviewMiddleware } = require('./tools/review-middleware');

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
  // Attribute text for human-readable labels: strip tags, keep existing HTML
  // entities intact (titles already contain e.g. &amp;), escape only quotes.
  function labelText(s) {
    return String(s).replace(/<[^>]*>/g, '').replace(/"/g, '&quot;');
  }
  eleventyConfig.addShortcode('exercise', function (ex) {
    const spec = typeof ex === 'string' ? JSON.parse(ex) : ex;
    const ariaLabel = labelText(
      'Drum notation' + (spec.title ? ': ' + spec.title : '') + (spec.meta ? ' — ' + spec.meta : '')
    );
    const rendered = renderPattern(spec);
    // Scale-aware width floor: staves wider than ~620 viewBox units keep a
    // horizontal-scroll floor at 55% natural size so notes stay legible on
    // phones; narrower staves simply fit their container (no forced pan).
    // viewBox may have a non-zero origin (staves whose tuplet brackets sit
    // above the stave grow the box upward) — read the width, not position 3.
    const vb = /viewBox="[-\d.]+ [-\d.]+ ([\d.]+)/.exec(rendered);
    const natW = vb ? parseFloat(vb[1]) : 0;
    const minW = natW > 620 ? Math.round(natW * 0.55) : 0;
    const svg = rendered.replace(
      '<svg ',
      `<svg role="img" aria-label="${ariaLabel}" ${minW ? `style="min-width:${minW}px" ` : ''}`
    );
    const tipBlock = spec.tip
      ? `<div class="exercise-tip">${spec.tip}</div>`
      : '';
    // Optional prose + link, used by reference cards (e.g. /rudiments/) that
    // fold the description and "full lesson" link into the exercise block.
    const descBlock = spec.description
      ? `<p class="exercise-desc">${spec.description}</p>`
      : '';
    const linkBlock = spec.lessonUrl
      ? `<p class="exercise-lesson-link"><a href="${spec.lessonUrl}">${spec.lessonLabel || 'Open the full lesson →'}</a></p>`
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
            <h3 class="exercise-title">${spec.title || 'Exercise'}</h3>
            ${spec.meta ? `<div class="exercise-meta">${spec.meta}</div>` : ''}
          </div>
          ${controls}
        </div>
        ${descBlock}
        <div class="notation">${svg}</div>
        ${tipBlock}
        ${linkBlock}
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

  // Filter: count of every playable exercise on the site. Takes the
  // lessonContent map (slug → entry) and sums each entry's exercise list, so
  // the homepage quotes a number that moves with the content rather than a
  // hand-maintained constant.
  eleventyConfig.addFilter('exerciseCount', function (lessonContent) {
    return Object.keys(lessonContent || {}).reduce(
      (sum, slug) => sum + ((lessonContent[slug] && lessonContent[slug].exercises) || []).length,
      0
    );
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

  // "20–25 min" → "PT20M" for schema.org timeRequired. Returns '' when no
  // leading number is found so templates can omit the property.
  eleventyConfig.addFilter('isoDuration', d => {
    const m = /(\d+)/.exec(d || '');
    return m ? `PT${m[1]}M` : '';
  });

  // Flatten a track's levels into a single ordered lesson array — used on the
  // homepage where each track renders as one chapter rather than per-level.
  eleventyConfig.addFilter('flatTrackLessons', track =>
    (track.levels || []).flatMap(lv => lv.lessons || [])
  );

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
