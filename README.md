# Drum Town

Drum Town is a drum curriculum site, built with [Eleventy (11ty)](https://www.11ty.dev/) and [VexFlow](https://www.vexflow.com/). Notation is rendered server-side at build time, so the published site has zero JavaScript dependencies for the music notation.

## Structure

```
drum-town/
├── package.json              ← npm config, scripts
├── .eleventy.js              ← 11ty config + custom shortcodes
├── tools/
│   ├── notation-renderer.js  ← server-side VexFlow → SVG
│   ├── audit-lessons.js      ← validates exercise beat counts vs. time signatures
│   └── review-middleware.js  ← dev-only API behind the /dev/review/ dashboard
├── src/
│   ├── _data/
│   │   ├── curriculum.js     ← the full curriculum (foundations, tracks, mastery)
│   │   └── lessonContent.js  ← rich content for "ready" lessons
│   ├── _includes/
│   │   ├── base.njk          ← global layout (header, footer)
│   │   └── lesson.njk        ← lesson layout (deprecated, see lessons.njk)
│   ├── assets/
│   │   └── css/style.css     ← global stylesheet
│   ├── dev/
│   │   └── review.njk        ← lesson review dashboard (dev server only, not in builds)
│   ├── index.njk             ← homepage with the curriculum overview
│   ├── genres.njk            ← generates one page per genre
│   └── lessons.njk           ← generates one page per lesson
└── _site/                    ← built output (gitignored)
```

## Getting started

```bash
npm install
npm start          # dev server at http://localhost:8080 with live reload
npm run build      # one-off production build
```

## Adding a lesson

Lessons live in `src/_data/lessonContent.js`, keyed by slug. Each entry can include:

```javascript
'my-lesson-slug': {
  tagline:      "Short subtitle",
  duration:     "20 min",
  difficulty:   "Intermediate",
  focus:        "Coordination",
  prerequisites: ['some-other-slug'],
  nextLessons:   ['follow-up-slug'],
  bodyHtml:      "<p>The lesson prose...</p>",
  exercises: [
    {
      title: "1A — My Exercise",
      meta:  "4/4 · ♩ = 90",
      timeSignature: "4/4",
      hands: [ /* note specs */ ],
      feet:  [ /* note specs */ ],
      tip:   "Practice tip..."
    }
  ],
  listening: [
    { artist: "Drummer", work: "Album", note: "Track to focus on" }
  ]
}
```

The slug must match an entry in `src/_data/curriculum.js` (under foundations, a track level, or mastery). Once the slug exists in both files, set its `status` to `'ready'` in the curriculum, and the page will render with full content instead of the stub view.

## Notation specs

Each exercise has a `hands` array (rendered with stems up) and a `feet` array (stems down). Notes are described as:

```javascript
{ keys: ['g/5/x2'], duration: 'q' }                    // hi-hat quarter note
{ keys: ['g/5/x2', 'c/5'], duration: '8' }             // hi-hat + snare 8th (chord)
{ keys: ['f/4'], duration: 'q' }                       // bass drum quarter
{ keys: ['d/4/x2'], duration: 'q' }                    // hi-hat foot quarter
{ rest: true, duration: 'q' }                          // invisible spacer (default)
{ rest: true, duration: 'q', visible: true }           // visible rest glyph (rare)
```

Note conventions:
- **Hi-hat / ride** — `g/5/x2` (top of staff, x notehead)
- **Snare** — `c/5` (middle of staff)
- **Bass drum** — `f/4` (bottom space, stems down)
- **Hi-hat foot** — `d/4/x2` (below staff, x notehead, stems down)

Rests in the `feet` (or any) voice exist purely to position the next note at the correct beat — they are **not drawn** unless you set `visible: true`. The snare in the upper voice already conveys what's happening on those beats; a visible rest glyph would be redundant clutter. Use `visible: true` only when the rest is the *content* of the lesson (teaching silence, space, anticipation).

Optional spec fields:
- `repeatBegin: true` / `repeatEnd: true` — adds repeat barlines (visual only; audio loops indefinitely)
- `tuplets: [{ voice, start, length, num_notes, notes_occupied }]` — for triplets and other tuplets
- `beamGroups: [[num, denom], ...]` — controls how 8ths and 16ths beam together
- `articulation: 'open'` (per-note) — renders a small "o" above the note and routes the audio to the open-hi-hat voice. Apply to a hi-hat note (`g/5/x2`).

## Adding a new genre track

In `src/_data/curriculum.js`, add a new entry to `tracks[]` with `slug`, `title`, `tagline`, `description`, `icon`, and four `levels` (each with two or more lessons). Genre pages are generated automatically.

## Building for deployment

```bash
npm run build
```

The `_site/` directory is a fully static site — deploy it to Netlify, Vercel, GitHub Pages, S3, or any static host. There's no server-side runtime requirement and no client-side dependencies for notation rendering.

## Notes on the curriculum design

- **Foundations** is small on purpose. The minimum required before specializing in a genre, not an exhaustive method book.
- **Tracks** each have four levels: Beginner → Intermediate → Advanced → Expert. The progression should feel like clear vocabulary acquisition, not just escalating difficulty.
- **Generalist Path** is a curated meta-trail across the tracks for breadth-seeking learners. Each waypoint references a lesson that already lives in a track (no duplicate content); the ordering at each level respects prerequisites across genres (e.g., rock 8ths before funk 16ths, basic clave before 6/8 Afro-Cuban). When adding a new track lesson that materially changes the canonical vocabulary at its level, consider whether the path should reference it.
- **Mastery** topics are the things every advanced drummer eventually arrives at, regardless of what genre they came from.
- The `prerequisites` field on a lesson should list the *minimum* required knowledge to attempt it. Don't list "nice to have" — only "you'll be lost without."

## Contributing

Contributions are welcome — new lessons, notation fixes, and tooling improvements. See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, validation steps, and content guidelines. Known bugs live in [ISSUES.md](ISSUES.md); feature ideas in [IDEAS.md](IDEAS.md).

## License

[MIT](LICENSE)
