# drum.town — rebrand brief

## The idea

The URL is the brand: **drum.town**. Not a course, not an archive — a town.
A place drummers live in together. Every visitor is a neighbor working on the
same craft; the curriculum is the town's shared map, the metronome is the
clock tower, the lessons are rooms everyone has sat in. The current site reads
as a beautiful private manuscript; the rebrand should read as a warm, modern,
public place. "Everyone is in it together."

## What must be true of the winning direction

- **Modern.** Confident type scale, generous spacing, deliberate color, dark
  mode as a first-class theme (the notation layer is already currentColor +
  tokens, so theming is unblocked). Feels 2026, not archival.
- **Communal in language and design, not in features.** No accounts, no
  comments, no backend — this is a static Eleventy site and stays one. The
  community lives in voice ("we", "the town"), framing (progress as a shared
  road; "practicing now" energy without fake data), naming, and iconography.
  Honest always: never simulate activity that doesn't exist.
- **Content-first.** 217 lessons, 852 playable exercises, 40 rudiments are the
  town's treasure. The design serves reading prose, reading notation, and
  pressing play. Notation staves are the hero object of the site.
- **Mobile is a first-class citizen.** True-390px layouts verified (harness in
  tools/). The docked metronome must coexist with content at every width.

## Non-negotiables (keep or improve, never regress)

- IA and URLs stay: `/`, `/lessons/<slug>/`, `/genres/<slug>/`, `/rudiments/`,
  `/metronome/`. Content (prose, exercises, listening) is not the designer's
  to rewrite.
- The accessibility floor already built: skip link, `<main>` landmark, h1>h2>h3
  outline, labeled SVGs, `:focus-visible` rings, `prefers-reduced-motion`
  support, rem type. Design around it, never under it.
- Zero client dependencies for rendering; CSS stays one hand-written file with
  a `:root` token system (extend tokens, don't sprawl).
- Metronome + per-exercise playback stay; their affordances may be redesigned.

## Solve these (confirmed real, currently open)

- BL-045: the homepage has no primary action — a first-time visitor should be
  walked into the town (Start here → first lesson; returning visitors get
  Continue where you left off via existing localStorage progress).
- BL-036: the docked metronome overlaps lesson content at ~1280px.
- BL-037: on mobile the sidebar panel eats the first screen of every lesson.
- BL-044: chapter-list dash separators orphan at line wraps.
- Lesson pages stack four near-identical section labels in one quadrant.

## Audience

Absolute beginners (need welcome + a path), returning hobbyists (need
continuity + depth), plus keyboard/screen-reader users as full citizens.

## Deliverables (phase: directions)

2–3 direction boards, each a self-contained `board.html` (inline CSS, no
external requests except Google Fonts if essential) showing: homepage hero +
one chapter section, a lesson-page fragment (title block + one exercise card
with real notation look), nav + footer treatment, the docked metronome, and a
token sheet (colors both themes, type scale, spacing). Plus `rationale.md`
per direction: the idea in three sentences, how it says "town", what it
sacrifices. Boards must be honest to what Eleventy + one CSS file can ship.
