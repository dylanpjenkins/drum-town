// src/_data/chapters.js — the homepage's 19 ledger chapters, in ledger order.
//
// One list, derived from the curriculum, so the chapter panel (#chapter-index)
// and the ledger sections it links to cannot drift apart: index.njk reads the
// section id and the heading id for BOTH from this array, by position.
// tools/checks/check-skip-targets.js re-asserts the one-for-one match against
// the built HTML.
//
// The first Foundations chapter, the first genre track and the final chapter
// keep the ids #foundations / #tracks / #mastery. Those three are load-bearing
// beyond this page: the header nav and the footer link to them, chrome.js
// resolves them by href, check-nav-a11y.js asserts they resolve, and they are
// the URLs other sites have. Everything else gets `chapter-<slug>`.

const curriculum = require('./curriculum.js');

const chapters = [
  ...curriculum.foundations.sections.map((s, i) => ({
    id: i === 0 ? 'foundations' : `chapter-${s.slug}`,
    title: s.title,
  })),
  ...curriculum.tracks.map((t, i) => ({
    id: i === 0 ? 'tracks' : `chapter-${t.slug}`,
    title: t.title,
  })),
  { id: 'mastery', title: curriculum.mastery.title || 'Other Topics' },
];

const ids = new Set(chapters.map(c => c.id));
if (ids.size !== chapters.length) {
  throw new Error('chapters.js: duplicate chapter id — two curriculum slugs collided');
}

module.exports = chapters;
