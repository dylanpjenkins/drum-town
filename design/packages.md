# drum.town rebrand — build packages

Source of truth for *what*: design/system.md (§ references below). Source of
truth for *why*: design/DECISION.md. This file is the ordered plan; the
orchestrator may transcribe these entries into tools/backlog.json (this spec
deliberately does not edit that file).

**Rules (binding):**

- One package = one loop tick: **≤10 files, ~300 changed lines**.
- Every push deploys to drum.town, so the site must be **coherent after every
  package** — no half-broken intermediate states. The chosen order repaints
  first (tokens/type restyle every existing component at once), then swaps
  structures one at a time; at no point do two visual languages share a page
  beyond "new paint on old furniture."
- Acceptance is verifiable: named screenshots at **1280** and **true-390**
  (via `tools/mobile-viewport-harness.html?w=390&pages=…` — headless Chrome
  windows can't go below ~492px), plus `npm run build` green and
  `node tools/audit-site.js` gates where named. From PKG-3 onward, every
  screenshot set is taken **in both themes**.
- A11y floor (system.md §9) is re-checked in every package's acceptance, not
  just PKG-10.

Baseline gates that must hold after *every* package:
`dom.pagesMissingSkipLink = 0`, `dom.pagesMissingMain = 0`,
`dom.headingOrderViolations = 0`, `css.missingFocusVisible = 0`,
`css.outlineNone = 0`, `css.missingReducedMotion = 0`, `css.pxFontSizes = 0`.

---

## PKG-1 — Token + type foundation ("the repaint")

- **Files (2):** `src/assets/css/style.css`, `src/_includes/base.njk`
- **Implements:** system.md §1.1, §1.2 (light values into existing slots +
  new slots `--accent-ink --green --green-tint --notation-accent --elev-1
  --elev-2 --header-h --transport-h --focus-ring`), §1.4 (families, weight
  map, scale, prose leading; `@import` → head `<link>`s with preconnect),
  §1.5 (radius/shadow tokens), §2 (links, focus ring retint, buttons, chips
  rules parked for later use, `.sr-only`), the 11px meta floor (every mono
  size ≤10.5px raised per §1.4), and global retints of *existing* components
  only (headings, prose, cards, sidebar, old metronome, old chapter chips) —
  **no structural/markup changes** beyond the font links.
- **Coherence:** new palette + type on the unchanged layout — the site reads
  as intentionally repainted; nothing references components that don't exist
  yet.
- **Acceptance:**
  - 1280 + 390 screenshots of `/`, `/lessons/single-paradiddle/` (or first
    ready lesson), `/rudiments/`: Fraunces headings, Public Sans body, Plex
    Mono meta; plaster/brick palette everywhere; staves on white; old layout
    intact and un-broken.
  - Network panel / built HTML: exactly one Google Fonts CSS request pinned
    to `Fraunces ital,wght 0,600;1,600 · Public Sans 0,400;0,600;0,700;1,400 ·
    Plex Mono 400;500`; latin woff2 total ≈ **113 KB** (≤120 KB hard cap);
    no `opsz` axis requested; `@import` gone from style.css.
  - `grep -E "font-size:\s*0\.(59|6[0-6])" src/assets/css/style.css` → no
    matches (nothing below 0.6875rem/11px); `css.pxFontSizes = 0`.
  - Focus ring visible on a nav link + play button (keyboard walk).
- **Depends on:** —

## PKG-2 — Header chrome + real mobile nav

- **Files (4):** `src/_includes/base.njk`, `src/assets/css/style.css`,
  `src/assets/js/chrome.js` (new), `src/lessons.njk` *(only if the script tag
  list moves — otherwise 3)*
- **Implements:** system.md §3 — seal + `drum.town` wordmark, 5-link nav
  (adds **Metronome**, DECISION amendment 3), nav-toggle disclosure ≤720px,
  `--header-h` wired to sidebar `top` and global
  `[id]{scroll-margin-top:…}`; chrome.js (nav open/close, Esc, focus
  return); `<script src="/assets/js/chrome.js" defer>` added in base.njk.
  Theme toggle button and clock pill are **not** in this package (they land
  with PKG-3/PKG-4 so no dead controls ship).
- **Coherence:** complete new header on the repainted site; old footer and
  old floating metronome still present and consistent.
- **Acceptance:**
  - 1280 screenshot: seal + wordmark, five links, active state on the
    current section; keyboard focus ring on a nav link.
  - true-390 screenshot pair (closed/open): logo + hamburger only; open
    panel lists all five destinations as ≥44px rows; Esc closes and focus
    returns to the toggle (manual walk noted in the log).
  - Clicking `/#tracks` from a lesson lands with the heading fully below the
    sticky header (scroll-margin verified at 1280 and 390).
  - Skip link remains the first tab stop; baseline gates hold.
- **Depends on:** PKG-1

## PKG-3 — Theme toggle + dark theme

- **Files (3):** `src/assets/css/style.css`, `src/_includes/base.njk`,
  `src/assets/js/chrome.js`
- **Implements:** system.md §1.3 in full — fenced DARK-TOKENS block
  duplicated into `@media (prefers-color-scheme: dark)
  :root:not([data-theme="light"])` and `:root[data-theme="dark"]`; pre-paint
  inline head script; `theme-color` metas (light+dark); §3 theme-toggle
  button (placement, icon swap, aria-label flip, `dc_theme` persistence,
  system-follow when unset).
- **Coherence:** every component is token-driven after PKG-1, so the whole
  site (including the still-old metronome card and chapter chips) themes
  correctly in one shot; later packages inherit dark for free.
- **Acceptance:**
  - Screenshot matrix: `/` and one lesson at 1280 + 390, light **and** dark
    (4 shots each page): umber ground, terra links/CTAs, **staves stay
    manuscript-lit** in dark.
  - Toggle flips instantly with no unstyled flash on reload (persisted);
    clearing localStorage + OS-dark emulation yields dark (system-follow);
    explicit choice beats OS setting.
  - `css.missingDarkScheme = 0`; dark-token sync gate: node one-liner
    comparing the two `DARK-TOKENS-BEGIN/END` fenced bodies → identical.
  - Spot contrast check against system.md §1.3 table (ink/bg, accent/bg,
    accent-ink/accent, green/bg) — computed, recorded in the log.
- **Depends on:** PKG-1, PKG-2 (toggle lives in the new header)

## PKG-4 — Transport dock + clock pill (kills BL-036)

- **Files (3):** `src/_includes/base.njk`, `src/assets/css/style.css`,
  `src/assets/js/metronome.js`
- **Implements:** system.md §7 in full — aside re-housed as `.transport`
  dock (control IDs preserved), header `#metronome-pill` (collapsed
  clock-tower state, live BPM/sig, running pulse), `html.transport-open`
  body padding reserve via `--transport-h` (64px / 100px ≤720px),
  **red downbeat dot** (`--accent`) vs `--gold` beats, collapse default,
  Esc/focus-return, reduced-motion color-only dots; old `.metronome*` CSS
  deleted.
- **Coherence:** the floating-card metronome disappears the same push the
  dock arrives; pill present at every width.
- **Acceptance:**
  - 1280 screenshot of a long lesson scrolled to the bottom with the dock
    **open**: last exercise card + graduation criteria fully visible above
    the dock (body reserve working — BL-036's ~1280px overlap impossible);
    same proof at true-390.
  - true-390 screenshot: two-row dock, all controls ≥44px, nothing clipped.
  - Pill states: collapsed default on first visit (all widths); running ⇒
    pill dot pulses + ■; downbeat dot renders `--accent`, other beats
    `--gold` (screenshot mid-tick or class-forced).
  - `dc_metro_collapsed` persistence honored across reloads; metronome
    keeps ticking through collapse; BPM typed in the dock appears in the
    pill.
  - Reduced-motion emulation: dots change color only (no scale), per the
    existing CSS kill-block extended.
  - Both themes screenshotted at 1280.
- **Depends on:** PKG-1, PKG-2 (pill slot in header); independent of PKG-3
  order-wise but scheduled after so dock ships theme-aware.

## PKG-5 — Ledger homepage (hero thesis + chapters; kills BL-044/BL-045-hero)

- **Files (3):** `src/index.njk`, `src/assets/css/style.css`, `.eleventy.js`
  (adds the 5-line `exerciseCount` filter)
- **Implements:** system.md §5.1 (thesis headline "The whole town practices
  to the same clock.", CTA pair with conditional continue, honesty line,
  completed message; hero-upnext swap removed), §5.2 (ledger rows with
  minutes from `lessonContent`, dotted leaders, ✓/● marks on
  `.is-visited`/`.is-last-visited`, sr-only state text, legend, **the
  mandatory 390px two-line stacking**), activation-script retarget
  (`.ledger-row`, `#cta-continue`); old `.chapter*`/`.chapter-lesson*`/
  `.hero-upnext*`/`.curriculum-hero` CSS deleted.
- **Coherence:** homepage swaps wholesale in one push; lesson/genre pages
  still old-but-repainted (consistent palette/type).
- **Acceptance:**
  - 1280 screenshot: hero thesis + single primary CTA (fresh profile);
    ledger rows show `01 · title · dotted leader · 12 min`; chapter heads
    "Chapter N of 19" with 2px ink rule.
  - Progress simulation (visit two lessons): ✓ done marks in green,
    ● here row with inset accent bar, ghost "Continue — <next title> →"
    CTA appears with correct href; end-of-order case shows the completed
    message instead.
  - true-390 screenshot: rows stack per §5.2 grid (`num | title` /
    `12 min · ✓ done` on line 2), leaders hidden, no orphaned separators of
    any kind, rows ≥48px tall; hero buttons stacked full-width.
  - `exerciseCount` renders 852; `lessonCount` unchanged; anchors
    `#foundations/#tracks/#mastery` land correctly (scroll-margin).
  - `dom.headingOrderViolations = 0` (h1 hero → h2 ledger titles).
- **Depends on:** PKG-1 (tokens/type); benefits from PKG-2 anchors. Can run
  parallel to PKG-4.

## PKG-6 — Lesson page: title block + lesson-map disclosure (kills BL-037 + label pile-up)

- **Files (5):** `src/lessons.njk`, `src/_includes/curriculum-sidebar.njk`,
  `src/_includes/section-nav.njk`, `src/assets/js/chrome.js`,
  `src/assets/css/style.css`
- **Implements:** system.md §6.1 (breadcrumb consolidation with
  subSection/track/level titles; `.eyebrow` deleted from lesson pages;
  `.lesson-chips` replacing `.lesson-meta`; prereqs restyle), §6.3 (sidebar
  → closed-by-default disclosure ≤960px, `aria-expanded` toggle in
  chrome.js; desktop sticky under `--header-h`; same treatment for
  section-nav on genre pages).
- **Coherence:** lesson pages get their final head + nav shape; prose below
  is still PKG-1-repainted (consistent).
- **Acceptance:**
  - true-390 screenshot of a lesson: **first viewport shows breadcrumb, h1,
    tagline/chips — not the sidebar** (BL-037); disclosure bar reads "In
    this chapter · <name> ▾", opens/closes with correct `aria-expanded`,
    closed on every load.
  - 1280 screenshot: one breadcrumb line + one chip row where four stacked
    labels used to be; each section name appears ≤2 times on the page
    (count logged) — BL-045 label half.
  - Sidebar sticky top equals `--header-h` (no gap/overlap at 1280); the
    auto-centering scroll still works.
  - Keyboard: disclosure reachable/operable; baseline gates hold.
- **Depends on:** PKG-1, PKG-2 (chrome.js, `--header-h`)

## PKG-7 — The reading room: prose set + exercise card + honest mobile notation

- **Files (3):** `src/assets/css/style.css`, `.eleventy.js`,
  `tools/notation-renderer.js`
- **Implements:** system.md §6.2 (paragraphs/lists/tip-callout/graduation
  criteria/listening/where-next), §6.4 (exercise card, kit select, play
  button states incl. `.is-playing`/`.is-loading`), §6.5 in full — sticking
  font 10→14 (grace 8→10), default height 130→140 when sticking present,
  min-width floor 0.55→0.70 in the shortcode, `.notation--pan` class +
  edge-fade/thin-scrollbar affordance, playhead → `--notation-accent`.
- **Coherence:** all 217 lessons + /rudiments/ upgrade together (shortcode +
  renderer are global); no page shows mixed exercise styles.
- **Acceptance:**
  - true-390 screenshot of the single-paradiddle lesson: sticking letters
    legible (≈9.8px rendered at the 70% floor — measure one letter in the
    shot), accents visible, stave pans with a visible right-edge fade;
    **nothing removed** relative to desktop.
  - 1280 screenshot: no annotation clipping on any of: a sticking-heavy
    rudiment card, a flam/drag card (grace sticking), a 2-bar exercise;
    sticking now renders ~14px at natural scale.
  - Prose shot at 1280: 65ch measure, lh 1.7, tip/callout with green edge,
    graduation criteria with green checks, listening rows with 11px-floor
    numbers.
  - Play-button walk: idle ▶ (accent fill), loading pulse, playing ■
    (`--accent-2`) — player.js untouched.
  - Build re-renders all staves green (`npm run build`); spot-diff two SVGs
    to confirm annotation size change; `content-visibility` rules intact on
    `/rudiments/` (scroll perf sanity).
- **Depends on:** PKG-1 (PKG-6 for final title block in screenshots, not
  functionally)

## PKG-8 — Genre, rudiments, metronome, 404 pages

- **Files (5):** `src/genres.njk`, `src/rudiments.njk`, `src/metronome.njk`,
  `src/404.njk`, `src/assets/css/style.css`
- **Implements:** system.md §8.3 (real `.breadcrumb` replaces the inline-
  styled one — closes the BL-032 instance; h1/tagline split; level lists as
  ledger rows with minutes), §8.4 (family index chips → existing group ids),
  §8.5 (two UI-truth copy sentences + "Open the metronome" button wired to
  the dock-expand path), §8.6 (404 CTA pair).
- **Coherence:** last remaining old-shaped pages join the system; site is
  visually complete.
- **Acceptance:**
  - 1280 + 390 screenshots ×4 pages (both themes at 1280): genre ledger rows
    show minutes; rudiments chips jump to families with heading clear of the
    sticky header; metronome page button expands the dock; 404 shows the CTA
    pair.
  - `grep -n "style=" src/genres.njk` → no inline styles remain.
  - Genre level lists carry num/min columns from lessonContent (verify one
    known duration).
  - Baseline gates hold across the full build.
- **Depends on:** PKG-5 (ledger CSS), PKG-6 (breadcrumb/title block), PKG-4
  (dock expand hook for §8.5)

## PKG-9 — Footer notice board + seal favicon

- **Files (3):** `src/_includes/base.njk`, `src/assets/css/style.css`,
  `src/assets/img/seal.svg` (new)
- **Implements:** system.md §4 (four-column notice board, motto, fine print,
  base counts line; 820/560 collapse), seal favicon
  (`<link rel="icon" type="image/svg+xml" href="/assets/img/seal.svg">` —
  the SVG carries both-theme-safe strokes; closes open BL-009 as a bonus).
- **Coherence:** footer was intentionally minimal until now; this completes
  the chrome.
- **Acceptance:**
  - 1280 screenshot: 4 columns, motto in Fraunces italic, counts base line
    at the 11px floor; dark-theme shot.
  - true-390 screenshot: single column, id block first, ≥44px link targets.
  - Favicon visible in a browser tab (light + dark UI); footer `<nav>`
    labels present; `dom.headingOrderViolations = 0` (footer headings
    verified — drop to styled `<p>` if the audit flags them).
- **Depends on:** PKG-1 (PKG-2 for header parity in screenshots)

## PKG-10 — Polish + QA sweep (release gate)

- **Files (≤6, all small):** `src/assets/css/style.css` + any file with a
  logged nit; no new components.
- **Implements:** system.md §9 verification end-to-end; deletes orphaned CSS
  (`.tracks-grid` media rule and anything the migration map marked
  *replace* that still lingers); vocabulary-leash sweep (§10) over all
  chrome strings.
- **Acceptance (the full matrix, recorded in the loop log):**
  - Screenshot grid: 6 pages (`/`, lesson, genre, `/rudiments/`,
    `/metronome/`, 404) × {1280, true-390} × {light, dark} = 24 shots, all
    coherent, dock open in at least one shot per width.
  - `node tools/audit-site.js`: all baseline gates 0;
    `css.missingDarkScheme = 0`; no metric regressed vs
    `tools/audit-site-baseline.json`.
  - Dark-token sync gate green; font bill re-measured ≤120 KB; no
    `@import` in CSS; `grep -E "font-size:\s*0\.(59|6[0-6])"` empty;
    `grep -c "style=" src/*.njk src/_includes/*.njk` = 0 (or each remaining
    instance justified in the log).
  - Keyboard walk on `/` and one lesson: skip link → header → nav/toggles →
    pill → content → dock; every stop has a visible ring; Esc paths work.
  - Reduced-motion pass (emulated): no scale/slide anywhere; beats carry by
    color.
  - BL-036, BL-037, BL-044, BL-045 acceptance lines from tools/backlog.json
    each re-verified against the shipped site and noted ready to close.
- **Depends on:** PKG-1 … PKG-9

---

### Dependency graph / parallelism

```
PKG-1 ──► PKG-2 ──► PKG-3 ──► PKG-4 ──► PKG-8 ──► PKG-10
   │         │                    ▲         ▲
   │         └──► PKG-6 ──────────┼─────────┤
   ├──────────► PKG-5 ────────────┼─────────┘
   ├──────────► PKG-7 ────────────┘   (PKG-7 gates PKG-8 screenshots only)
   └──────────► PKG-9
```

Strict chain: 1 → 2 → 3 → 4 → 8 → 10. PKG-5, PKG-6, PKG-7, PKG-9 can
interleave anywhere after their listed dependencies; the printed order
(1,2,3,4,5,6,7,8,9,10) is the recommended single-lane sequence — chrome
first (so every page shares one shell), then the front door, then the
reading experience, then the long tail, then the bow.
