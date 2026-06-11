// src/_data/lessonsData.js
// Build-time map of slug → rich data the homepage hero needs when swapping
// to the "Up Next" state. Includes the lesson's chapter eyebrow, position
// in the ready-only flat order, before/after neighbors, and a pre-rendered
// preview-notation SVG (when the lesson's content defines `previewExercise`).
//
// Consumed by src/index.njk via an inline <script type="application/json">.
// JS reads `dc_progress.lastVisited` from localStorage, looks up the slug
// AFTER it in `order`, and swaps the hero to that lesson's data.

const curriculum = require('./curriculum.js');
const lessonContent = require('./lessonContent.js');
const { renderPattern } = require('../../tools/notation-renderer.js');

function flatten() {
  const out = [];
  const foundationsCount = curriculum.foundations.sections.length;
  const tracksCount = curriculum.tracks.length;

  curriculum.foundations.sections.forEach((sec, secIdx) => {
    sec.lessons.forEach(l => {
      out.push({
        slug: l.slug,
        title: l.title,
        status: l.status,
        chapterIndex: secIdx + 1,
        chapterTitle: sec.title
      });
    });
  });
  curriculum.tracks.forEach((t, tIdx) => {
    t.levels.forEach(lv => {
      lv.lessons.forEach(l => {
        out.push({
          slug: l.slug,
          title: l.title,
          status: l.status,
          chapterIndex: foundationsCount + tIdx + 1,
          chapterTitle: t.title
        });
      });
    });
  });
  const masteryChapter = foundationsCount + tracksCount + 1;
  curriculum.mastery.lessons.forEach(l => {
    out.push({
      slug: l.slug,
      title: l.title,
      status: l.status,
      chapterIndex: masteryChapter,
      chapterTitle: 'Other Topics'
    });
  });
  return out;
}

function eyebrowFor(l) {
  return `Chapter ${l.chapterIndex} · ${l.chapterTitle}`;
}

module.exports = function () {
  const ready = flatten().filter(l => l.status === 'ready');
  const total = ready.length;
  const bySlug = {};

  ready.forEach((l, i) => {
    const content = lessonContent[l.slug];
    const preview = content && content.previewExercise;
    let notationSvg = null;
    let notationLabel = null;
    if (preview) {
      try {
        notationSvg = renderPattern({
          width: 380,
          height: 110,
          ...preview
        });
        const parts = [];
        if (preview.title) parts.push(preview.title);
        if (preview.bpm) parts.push(`♩=${preview.bpm}`);
        if (preview.timeSignature) parts.push(preview.timeSignature);
        notationLabel = parts.join(' · ');
      } catch (e) {
        // Bad preview spec — degrade silently to no-preview state.
        notationSvg = null;
        notationLabel = null;
      }
    }
    const prev = i > 0 ? ready[i - 1] : null;
    const next = i < ready.length - 1 ? ready[i + 1] : null;
    bySlug[l.slug] = {
      title: l.title,
      url: `/lessons/${l.slug}/`,
      tagline: (content && content.tagline) || '',
      eyebrow: eyebrowFor(l),
      lessonNumber: i + 1,
      totalLessons: total,
      hasPreview: Boolean(notationSvg),
      notationSvg,
      notationLabel,
      before: prev ? { title: prev.title, url: `/lessons/${prev.slug}/` } : null,
      after: next ? { title: next.title, url: `/lessons/${next.slug}/` } : null
    };
  });

  return {
    bySlug,
    order: ready.map(l => l.slug),
    total,
    firstSlug: ready[0] ? ready[0].slug : null,
    lastSlug: ready[ready.length - 1] ? ready[ready.length - 1].slug : null
  };
};
