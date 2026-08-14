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
  // The six signatures the transport dock's meter select actually offers
  // (src/_includes/base.njk), mapped to the option VALUES it uses. Keyed by the
  // whole signature on purpose — see the tempo-handoff comment below. If a
  // seventh option is ever added to the dock, add it here too;
  // tools/checks/check-tempo-handoff.js reads the built select and fails if the
  // two ever disagree.
  const DOCK_METERS = { '2/4': 2, '3/4': 3, '4/4': 4, '5/4': 5, '6/8': 6, '7/8': 7 };
  // And the range its BPM input accepts. metronome.js clamps to the same pair,
  // so a tempo outside it does not merely fail to arrive — it arrives WRONG,
  // silently, as 240. Same file, same check reads these off the built input.
  const DOCK_MIN_BPM = 30, DOCK_MAX_BPM = 240;
  eleventyConfig.addShortcode('exercise', function (ex) {
    const spec = typeof ex === 'string' ? JSON.parse(ex) : ex;
    const ariaLabel = labelText(
      'Drum notation' + (spec.title ? ': ' + spec.title : '') + (spec.meta ? ' — ' + spec.meta : '')
    );
    const rendered = renderPattern(spec);
    // Scale-aware width floor: staves wider than ~620 viewBox units keep a
    // horizontal-scroll floor at 70% natural size so notes stay legible on
    // phones; narrower staves simply fit their container (no forced pan).
    // viewBox may have a non-zero origin (staves whose tuplet brackets sit
    // above the stave grow the box upward) — read the width, not position 3.
    //
    // 0.55 → 0.70 is system.md §6.5 step 2. At the old floor a 760-unit stave
    // shrank to 418px inside a ~320px phone scroller and the sticking row went
    // with it; the trade is a longer pan for a legible one. Nothing is dropped
    // at either floor — the whole bar is always reachable by scrolling.
    const vb = /viewBox="[-\d.]+ [-\d.]+ ([\d.]+)/.exec(rendered);
    const natW = vb ? parseFloat(vb[1]) : 0;
    // DENSITY-AWARE FLOOR (BL-040). The flat 70% was a percentage of natural
    // width, and natural width is itself capped at 1400 units for multi-bar
    // phrases — so density got squeezed twice, and across the 432 staves that
    // take a floor it delivered anywhere from 13.6 to 116.7 px per notated
    // event. An 8.6x spread. The dense end sat at ~5px of sticking ink, which
    // is exactly the illegibility PKG-7 fixed for SINGLE bars and left in place
    // on multi-bar ones.
    //
    // Every constant here is derived rather than chosen:
    //   PX_PER_EVENT 28    VexFlow writes annotations in POINTS, so the 14pt
    //                      sticking is 18.67 user units and its rendered size
    //                      is 18.67 * (pxPerEvent / UNITS_PER_EVENT). PKG-7
    //                      measured 10px of sticking ink as legible at a true
    //                      390px, and 10 = 18.67 * (28 / 52). This floor
    //                      reproduces a measurement.
    //   UNITS_PER_EVENT 52 the renderer's own per-note width allowance
    //                      (notation-renderer.js: 140 + maxVoiceNotes * 52).
    //   PAN_THRESHOLD 620  unchanged. Below it a stave already fits a phone
    //                      scroller, so a floor would add panning for nothing.
    //   FLOOR_RATIO 0.70   system.md 6.5 step 2, kept as the lower bound for
    //                      wide-but-sparse staves where the density rule is slack.
    //
    // A 64-note four-bar phrase now floors at 1792px and pans about 5.6 screens
    // at 320px. That is a lot of panning, and it is the trade 6.5 states
    // outright: honest panning beats illegible shrinking. Nothing is dropped at
    // any width, at either floor.
    const PX_PER_EVENT = 28;
    const UNITS_PER_EVENT = 52;
    const PAN_THRESHOLD = 620;
    const FLOOR_RATIO = 0.70;
    const events = Math.max((spec.hands || []).length, (spec.feet || []).length, 1);
    const minW = natW > PAN_THRESHOLD
      ? Math.max(Math.round(natW * FLOOR_RATIO), events * PX_PER_EVENT)
      : 0;
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
      // Tempo handoff to the site metronome (BL-076). The exercise already knows
      // the tempo the player will use and the meta already prints it; the dock
      // was the only part of the page that never heard it, so the header pill
      // read 80 above notation marked ♩ = 70.
      //
      // The button carries data, not behaviour: metronome.js sets the dock from
      // these two attributes when the button is pressed, and only then. Nothing
      // adopts a tempo on scroll or on load — a reader who set 60 on purpose
      // keeps it.
      //
      // It is emitted ONLY when the dock can be made to agree with the notation
      // exactly. 60 of 892 exercises fail that test and get no button at all,
      // because in a component that has already shipped four false affordances a
      // correct absence beats a button that half-works:
      //
      //   Out of range (7). The dock's input is min 30 / max 240 and
      //   metronome.js clamps to the same pair, so jazz-up-tempo#3 at ♩ = 280
      //   would set 240 — a click 14% slow against the notation, with nothing on
      //   screen admitting it.
      //
      //   Denominator not 4 (53). This is a unit collision, not a missing
      //   option. spec.bpm is QUARTER-note BPM (pattern-math.js:4) while the
      //   dock's number is clicks per minute and beatsPerBar is clicks per BAR,
      //   so numerator-as-beats only matches the notated bar when a beat is a
      //   quarter. Measured across the corpus: every x/8 spec gives
      //   dockBar / notatedBar = 2 exactly, and every x/4 gives 1. In 6/8 at
      //   ♩. = 80 the notated bar is 2.25s and the dock's would be 4.5s, so the
      //   accent lands on a barline every OTHER bar — worst on the four 6/8
      //   rudiment lessons and all of latin-6-8-afro-cuban, whose whole subject
      //   is that pulse. Halving beats to 3 fixes the barline but clicks on
      //   eighths 1-3-5 (a cross-rhythm, not the pulse) and would make the dock
      //   read "3/4"; doubling the tempo to 160 with 6 beats is musically exact
      //   but prints METRONOME 160 beside notation marked 80, and 12/8 at 180
      //   would need 360 and leave the range anyway. There is also no single
      //   tempo on those pages to hand over: 6/8 metas say ♩. = 80 where the
      //   player plays ♩ = 80, a 1.5x disagreement the page prints in full.
      //
      // Both rules are enforced against the BUILT dock markup by
      // tools/checks/check-tempo-handoff.js, so the shortcode cannot drift from
      // the controls it is talking to.
      const ts = String(spec.timeSignature || '').trim();
      const beats = Number(ts.split('/')[1]) === 4 ? DOCK_METERS[ts] : undefined;
      const canHandOff = beats !== undefined && spec.bpm >= DOCK_MIN_BPM && spec.bpm <= DOCK_MAX_BPM;
      // The visible label is the head of the accessible name, so voice control
      // has a string to land on (WCAG 2.5.3) and a screen reader still gets the
      // unit, the meter and what pressing it will do. A comma, not a dash —
      // screen readers announce an em dash.
      const handoff = canHandOff
        ? `
          <button class="tempo-btn" type="button" data-exercise-metronome data-bpm="${spec.bpm}" data-beats="${beats}" aria-label="${labelText(`Metronome ${spec.bpm} BPM in ${ts}, opens the metronome`)}">Metronome ${spec.bpm}</button>`
        : '';
      controls = `
        <div class="exercise-controls">
          <select class="kit-selector__select" data-exercise-kit aria-label="Drum kit sound">
            <option value="electronic">Electronic</option>
            <option value="acoustic">Acoustic</option>
          </select>${handoff}
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
        <div class="notation${minW ? ' notation--pan' : ''}">${svg}</div>
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
