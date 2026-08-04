// src/_data/lessonsData.js
// Build-time map of slug → the data the homepage hero needs when swapping to
// the "Up Next" state: chapter eyebrow, tagline, and the previous lesson for
// the review link.
//
// Consumed by src/index.njk via an inline <script type="application/json">.
// JS reads `dc_progress.lastVisited` from localStorage, looks up the slug
// AFTER it in `order`, and swaps the hero to that lesson's data.

const curriculum = require('./curriculum.js');
const lessonContent = require('./lessonContent.js');

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
    const prev = i > 0 ? ready[i - 1] : null;
    bySlug[l.slug] = {
      title: l.title,
      url: `/lessons/${l.slug}/`,
      tagline: (content && content.tagline) || '',
      eyebrow: eyebrowFor(l),
      before: prev ? { title: prev.title, url: `/lessons/${prev.slug}/` } : null
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
