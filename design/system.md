# drum.town design system — "The Square," amended

Phase: **spec** (per design/DECISION.md). This file expands the winning direction —
A "The Square" with B's transport dock, C's ledger + prose discipline, and the
shared-violations contract — into a buildable system against the *real* codebase
(src/assets/css/style.css, src/_includes/base.njk, the page templates, and the
exercise shortcode in .eleventy.js). Build order lives in design/packages.md.

Identity in one line: **warm civic modern** — the town as literal shared
infrastructure. Plaster and brick in daylight, umber and lamplight in the
evening; Fraunces speaks, Public Sans works, IBM Plex Mono measures. The staves
stay the brightest object on every page, in both themes.

Ground rules inherited (non-negotiable):

- IA and URLs unchanged. Content (prose, exercises, listening) is not rewritten;
  only chrome labels and UI-referential copy may change (each case is flagged).
- One hand-written CSS file; `:root` tokens; zero client dependencies.
- The a11y floor (skip link, `<main>`, h1>h2>h3, labeled SVGs, `:focus-visible`,
  `prefers-reduced-motion`, rem type) is preserved everywhere — see §9.
- Metaphor on a leash: nav labels stay literal (Foundations / Genres / Other
  Topics / Rudiments / Metronome). Legend vocabulary ("streets you've walked",
  "you are here") lives on the homepage ledger legend and nowhere else.
  Footer motto is the one sanctioned poetry zone.

---

## 1. Tokens

### 1.1 Slot policy

Every slot name that exists today is **kept** (`--bg --paper --paper-2 --ink
--ink-2 --ink-3 --ink-soft --rule --rule-soft --accent --accent-2 --ochre
--gold --shadow --notation-bg --notation-ink`). Values change; names do not.
New slots are **added**, never renamed:

| new slot | job |
|---|---|
| `--accent-ink` | text/icon color on `--accent` fills (buttons, "here" row) |
| `--green` | progress/visited/success (park green) |
| `--green-tint` | translucent green wash (ghost-button hover, done-row tint) |
| `--notation-accent` | accent used *inside* notation frames (playhead, accent marks) — constant across themes because the stave ground is constant |
| `--elev-1`, `--elev-2` | composed box-shadows (card, raised card) |
| `--header-h` | sticky-header height; drives sidebar `top`, anchor `scroll-margin-top` |
| `--transport-h` | open transport-dock height; drives the body bottom reserve |
| `--focus-ring` | focus outline color (equals accent in both themes; separate slot so it can diverge if a theme ever needs it) |

`--shadow` stays a **color** (it is used inside `box-shadow:` today); the
composed shadows are the new `--elev-*` slots.

### 1.2 Light theme — "morning in the square" (default)

```css
:root {
  --bg:        #f7f2e9;   /* plaster — page ground */
  --paper:     #fffcf5;   /* cards, panels, ledger hover */
  --paper-2:   #efe6d3;   /* wells, footer, code-ish surfaces */
  --ink:       #262019;   /* headings, primary text */
  --ink-2:     #322a20;   /* running prose */
  --ink-3:     #4c4335;   /* ledes, tertiary prose */
  --ink-soft:  #5c5346;   /* secondary/meta text */
  --rule:      #ddd2bd;   /* borders */
  --rule-soft: #e9e0cd;   /* hairlines */
  --accent:    #9a3a27;   /* brick — links, primary fills, focus */
  --accent-2:  #8d341f;   /* brick pressed/hover (darker) */
  --accent-ink:#fffcf5;   /* text on brick */
  --green:     #2f6b4f;   /* park green — progress/visited */
  --green-tint: rgba(47,107,79,.10);
  --ochre:     #b8943f;   /* decorative brass — borders/marks only, never text */
  --gold:      #c99a3c;   /* decorative brass (seal dots) — never text */
  --shadow:    rgba(38,32,25,.08);
  --elev-1:    0 1px 3px var(--shadow);
  --elev-2:    0 2px 6px var(--shadow), 0 12px 32px var(--shadow);
  --notation-bg:  #ffffff;
  --notation-ink: #262019;
  --notation-accent: #9a3a27;
  --focus-ring: var(--accent);
  --header-h: 60px;        /* measure after PKG-2 lands; token is the source of truth */
  --transport-h: 64px;     /* open dock height; 100px at ≤720px (media re-declaration) */
}
```

**Computed WCAG 2.x ratios (light)** — computed with the standard relative-
luminance formula, not eyeballed:

| pair | ratio | verdict |
|---|---|---|
| `--ink` / `--bg` | **14.45:1** | AAA |
| `--ink` / `--paper` | **15.73:1** | AAA |
| `--ink` / `--paper-2` | **12.99:1** | AAA |
| `--ink-2` / `--bg` | **12.66:1** | AAA |
| `--ink-2` / `--paper` | **13.78:1** | AAA |
| `--ink-3` / `--bg` | **8.71:1** | AAA |
| `--ink-3` / `--paper` | **9.48:1** | AAA |
| `--ink-soft` / `--bg` | **6.77:1** | AA+ (passes AAA at ≥18.66px/bold) |
| `--ink-soft` / `--paper` | **7.37:1** | AAA |
| `--ink-soft` / `--paper-2` | **6.09:1** | AA+ |
| `--accent` / `--bg` (links) | **6.26:1** | AA+ |
| `--accent` / `--paper` | **6.81:1** | AA+ |
| `--accent` / `--paper-2` | **5.63:1** | AA+ |
| `--accent-ink` / `--accent` (buttons) | **6.81:1** | AA+ |
| `--accent-ink` / `--accent-2` (hover) | **7.75:1** | AAA |
| `--green` / `--bg` | **5.64:1** | AA+ |
| `--green` / `--paper` | **6.14:1** | AA+ |
| `--paper` on `--green` fill (done stamp) | **6.14:1** | AA+ |
| `--notation-ink` / `--notation-bg` | **16.12:1** | AAA |
| `--notation-accent` / `--notation-bg` | **6.98:1** | AA+ |
| `--focus-ring` / `--bg` (non-text, needs 3:1) | **6.26:1** | pass |
| `--gold`, `--ochre` / `--bg` | 2.30 / 2.56 | decorative only — **never text**, enforced in §7 |

### 1.3 Dark theme — "evening in the square"

Shipped as a **re-declaration of the same custom properties**, twice, in this
exact pattern (auto default + explicit override; toggle always wins):

```css
/* ==== DARK-TOKENS (auto) — keep byte-identical with the block below ==== */
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { /* …dark values… */ }
}
/* ==== DARK-TOKENS (explicit) ==== */
:root[data-theme="dark"] { /* …same dark values… */ }
```

The duplicated inner block is fenced with `/* DARK-TOKENS-BEGIN */ …
/* DARK-TOKENS-END */` comments in both places; a build gate compares the two
fenced bodies for equality (see packages PKG-3). No parallel token sets, no
`--d-*` prefixes.

Dark values:

```css
--bg:        #211a14;   /* warm umber ground */
--paper:     #2b231b;
--paper-2:   #352b21;
--ink:       #f2e9dc;
--ink-2:     #e6dbc9;
--ink-3:     #d3c5ae;
--ink-soft:  #c4b6a3;
--rule:      #4a3e30;
--rule-soft: #3a3024;
--accent:    #e07b5c;   /* terra — the same rust hue family, lifted for dark */
--accent-2:  #e8916f;   /* hover (lighter in dark) */
--accent-ink:#211a14;   /* near-black text on terra fills */
--green:     #8ec7a6;
--green-tint: rgba(142,199,166,.14);
--ochre:     #c9a35c;   /* decorative */
--gold:      #e3a34d;   /* lamplight brass — decorative */
--shadow:    rgba(0,0,0,.40);
--notation-bg:  #fffdf7;   /* staves stay manuscript-lit in the dark */
--notation-ink: #262019;
--notation-accent: #9a3a27; /* unchanged — it sits on the lit stave */
--focus-ring: var(--accent);
```

**One accent hue owns primary actions in both themes**: brick `#9a3a27` (light)
and terra `#e07b5c` (dark) are the same rust family. There is no amber CTA in
dark — amber (`--gold`) stays decorative lamplight. This corrects board A's
dark mini-mock, per the DECISION contract.

**Computed ratios (dark):**

| pair | ratio | verdict |
|---|---|---|
| `--ink` / `--bg` | **14.29:1** | AAA |
| `--ink` / `--paper` | **12.85:1** | AAA |
| `--ink` / `--paper-2` | **11.50:1** | AAA |
| `--ink-2` / `--bg` | **12.55:1** | AAA |
| `--ink-3` / `--bg` | **10.12:1** | AAA |
| `--ink-soft` / `--bg` | **8.64:1** | AAA |
| `--ink-soft` / `--paper` | **7.78:1** | AAA |
| `--ink-soft` / `--paper-2` | **6.96:1** | AA+ |
| `--accent` / `--bg` (links) | **5.85:1** | AA+ |
| `--accent` / `--paper` | **5.27:1** | AA+ |
| `--accent-ink` / `--accent` (buttons) | **5.85:1** | AA+ |
| `--accent-ink` / `--accent-2` (hover) | **7.13:1** | AAA |
| `--green` / `--bg` | **8.89:1** | AAA |
| `--green` / `--paper` | **8.00:1** | AAA |
| `--gold` / `--bg` (if ever labeled) | **7.86:1** | AAA (still kept decorative) |
| `--notation-ink` / `--notation-bg` | **15.84:1** | AAA |
| `--notation-accent` / `--notation-bg` | **6.86:1** | AA+ |
| `--focus-ring` / `--bg` (non-text) | **5.85:1** | pass |

Notation frames are **theme-invariant**: `--notation-bg/-ink/-accent` change
only slightly (pure white → warm white) so the score reads like a lit score in
the dark. Anything drawn inside `.notation` must use the `--notation-*` slots,
never `--accent`/`--ink` (the playhead migrates from `var(--accent)` to
`var(--notation-accent)`).

Also shipped with the theme work:

- `<meta name="theme-color" media="(prefers-color-scheme: light)" content="#f7f2e9">`
  and the dark twin (`#211a14`); chrome.js updates the active one on toggle.
- Pre-paint inline script in `<head>` **before** the stylesheet link:
  `try{var t=localStorage.getItem('dc_theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t)}catch(e){}`
  — no theme flash, no FOUC. No stored value ⇒ no attribute ⇒ media query rules.

### 1.4 Type

Families (board A, confirmed): **Fraunces** (display serif, warmth),
**Public Sans** (body/UI — the civic workhorse), **IBM Plex Mono** (meta,
measurements, ledger figures).

```css
--display: 'Fraunces', Georgia, serif;
--body:    'Public Sans', system-ui, -apple-system, sans-serif;
--mono:    'IBM Plex Mono', 'Courier New', monospace;
```

**Exact font-loading plan** (named weights only; no full variable axes — the
`opsz` axis on Fraunces is *not* requested):

- Replace the CSS `@import` at the top of style.css with head links in
  base.njk (removes the serialized CSS→font-CSS request chain):

  ```html
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,wght@0,600;1,600&family=Public+Sans:ital,wght@0,400;0,600;0,700;1,400&family=IBM+Plex+Mono:wght@400;500&display=swap">
  ```

- **Measured woff2 bill** (latin subset, the only subset English pages pull;
  content-lengths fetched from fonts.gstatic.com on 2026-08-05):

  | file | KB |
  |---|---|
  | Fraunces 600 roman | 23.0 |
  | Fraunces 600 italic | 18.1 |
  | Public Sans roman (one wght-trimmed file serves 400/600/700) | 26.8 |
  | Public Sans 400 italic | 15.6 |
  | IBM Plex Mono 400 | 14.7 |
  | IBM Plex Mono 500 | 14.9 |
  | **Total** | **≈ 113 KB** across 6 files |

  (Current site loads 10 instances across Cormorant Garamond/Lora/JetBrains
  Mono; this is a net reduction with fewer families.)

- Weight map — nothing outside this table may be used:

  | token | family, weight, style |
  |---|---|
  | display | Fraunces 600 |
  | display italic accents (`h1 em`, wordmark `.town`) | Fraunces 600 italic |
  | body | Public Sans 400 (+ 400 italic for `em` in prose) |
  | UI semibold (nav, chip labels, ledger titles' sans fallback) | Public Sans 600 |
  | UI bold (buttons, h3/h4, exercise titles) | Public Sans 700 |
  | meta / figures | IBM Plex Mono 400 |
  | meta emphasized (labels, BPM) | IBM Plex Mono 500 |

  Fraunces at 620/640 (board A used variable settings) rounds to **600**; the
  display sizes carry the warmth, not micro-weights.

**Scale** (rem, base 16px; all `font-size` declarations stay in rem — the
`css.pxFontSizes` audit metric must remain 0):

| step | size | family/weight | lh | tracking | use |
|---|---|---|---|---|---|
| display-1 | `clamp(2.5rem, 1.6rem + 4vw, 4rem)` (40→64px) | Fraunces 600 | 1.05 | −0.015em | homepage h1 only |
| display-2 | `clamp(2rem, 1.5rem + 2.5vw, 2.875rem)` (32→46px) | Fraunces 600 | 1.06 | −0.012em | lesson/page h1 |
| h2 | 2.125rem (34px); 1.75rem ≤720px | Fraunces 600 | 1.12 | −0.01em | chapter/ledger titles, section h2 |
| h3 | 1.25rem (20px) | Public Sans 700 | 1.25 | 0 | exercise titles, prose h3 |
| h4 | 1.0625rem (17px) | Public Sans 700 | 1.3 | 0 | rare |
| body | 1.0625rem (17px) | Public Sans 400 | **1.7** | 0 | prose |
| lede | 1.125rem (18px) | Public Sans 400 | 1.65 | 0 | page deks, `--ink-3` |
| small | 0.875rem (14px) | Public Sans 400 | 1.55 | 0 | captions, honesty line, tips |
| meta | 0.75rem (12px) | Plex Mono 500 | 1.4 | 0.14em, uppercase | eyebrows, labels, breadcrumbs |
| meta-sm | **0.6875rem (11px) — the floor** | Plex Mono 400/500 | 1.4 | 0.08–0.12em | ledger figures, exercise meta, footer base |

**Nothing renders below 0.6875rem (11px).** The current sheet has mono sizes
at 9.5–10.5px (`.eyebrow` 10px, `.curr-section__title` 9.5px,
`.prereqs__label` 9.5px, `.grad-criteria__label` 9.5px, `.chapter-lesson__num`
10px, `.listening__num/__context` 10px, `.island-back/-eyebrow` 10px, `.tag`
10.5px); every one is raised to meta (12px) or meta-sm (11px) in the token
package, and each sits on a surface where `--ink-soft`/`--accent` pass ≥4.5:1
(see §1.2/§1.3 tables).

**Prose discipline** (imported from C into A's palette): measure stays
`max-width: 65ch` on `.lesson-prose p/ul/ol` (≈ 555px at 17px — keep the
existing rule, new value only via line-height); body line-height 1.7;
paragraph spacing 0 0 1em; `em` renders true italic (Public Sans 400 italic
is loaded); `strong` = 600 `--ink`. Headings keep `overflow-wrap:
break-word`.

### 1.5 Spacing, radius, shadow

- **Spacing scale** (canonical values used literally, matching the one-file
  CSS style — not tokenized, to avoid slot sprawl): `4 8 12 16 24 32 48 64 96`.
  Any padding/margin/gap must be one of these (or a `clamp()` between two).
- **Radius tokens**: `--r-s: 8px` (inputs, chips-in-cards, notation frame),
  `--r-m: 12px` (cards inside cards, sidebar items), `--r-l: 16px` (exercise
  card, panels), `--r-pill: 999px` (buttons, chips, nav links, clock pill).
- **Shadow**: `--elev-1` for resting cards, `--elev-2` for the exercise card,
  transport dock, and open nav panel. In dark the same slots are recomputed
  via the darker `--shadow` color; borders (`--rule`) carry more of the
  separation in dark, shadows less.

---

## 2. Global primitives

- **Links**: `a { color: var(--accent) }`, hover underline
  (thickness 1px, offset 3px) — keep today's rule, retint.
- **:focus-visible** (site-wide, kept from today, retinted):
  `outline: 2px solid var(--focus-ring); outline-offset: 2px;` plus
  `border-radius: 2px` on inline links so the ring hugs text. On `--r-pill`
  elements the offset ring follows the curve automatically. Never
  `outline: none` anywhere (`css.outlineNone` metric stays 0).
- **prefers-reduced-motion**: the existing kill-all block is preserved
  verbatim, extended with the new moving parts: transport beat dots animate
  color only (no `transform` pulse — same pattern as today's rule), the
  clock-pill running dot pulses by color only, the mobile nav panel and
  transport dock appear/disappear instantly (no slide), theme switch has no
  transition.
- **`.sr-only` utility** (new): standard clipped text pattern; used for
  visited/current announcements in the ledger and the dock state.
- **Buttons** `.btn` (restyle): Public Sans 700, 0.9375rem, `--r-pill`,
  padding 12px 22px (primary hero: 14px 24px). `.btn--primary`:
  `background: var(--accent); color: var(--accent-ink);` hover/active
  `--accent-2`. `.btn--ghost`: transparent, `1.5px solid var(--green)`,
  `color: var(--green)`, hover `background: var(--green-tint)`. (Ghost = the
  "continue/companion" role, green = progress vocabulary.) Focus per global
  ring. Min target height 44px.
- **Chips** `.chip` (new, replaces `.lesson-meta` display): inline-flex,
  `--paper` bg, 1px `--rule` border, `--r-pill`, padding 6px 12px, Public
  Sans 600 0.8125rem `--ink`; leading glyph in `--accent` mono meta-sm,
  `aria-hidden`. Chips wrap; long free-text focus values wrap inside the chip
  (no ellipsis truncation of content).
- **Section labels** `.section-label` (keep class): meta step (12px Plex Mono
  500, 0.14em, uppercase, `--accent`).

---

## 3. Header — skyline chrome (incl. mobile nav, theme toggle, clock pill)

Markup (base.njk), replacing the current `.site-header__inner` contents:

```html
<header class="site-header">
  <div class="site-header__inner">
    <a href="/" class="site-logo">
      <svg class="site-logo__seal" viewBox="0 0 34 34" aria-hidden="true" focusable="false"><!-- ring + inner ring + 4 brass dots, stroke --accent / fill --gold --></svg>
      <span class="site-logo__wm">drum<em>.town</em></span>
    </a>
    <nav class="site-nav" id="site-nav" aria-label="Site">
      <a href="/#foundations">Foundations</a>
      <a href="/#tracks">Genres</a>
      <a href="/#mastery">Other Topics</a>
      <a href="/rudiments/">Rudiments</a>
      <a href="/metronome/">Metronome</a>
    </nav>
    <button class="theme-toggle" id="theme-toggle" type="button" aria-label="Switch to dark theme"><!-- inline sun/moon SVGs, currentColor, swapped via [data-theme] CSS --></button>
    <button class="clock-pill" id="metronome-pill" type="button" aria-expanded="false" aria-controls="site-metronome">
      <span class="clock-pill__dot" aria-hidden="true">▶</span>
      <b class="clock-pill__bpm">80</b><small class="clock-pill__sig">· 4/4</small>
      <span class="sr-only">beats per minute — open metronome</span>
    </button>
    <button class="nav-toggle" id="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Menu">
      <span class="nav-toggle__bars" aria-hidden="true"></span>
    </button>
  </div>
</header>
```

- **Desktop (>720px)**: logo left (seal 28px + Fraunces 600 wordmark 1.25rem,
  `.town` in italic `--accent`); nav `margin-left: auto`, links Public Sans
  600 0.84375rem (13.5px), `--ink-soft`, padding 7px 12px, `--r-pill`; hover
  `--accent` on `--paper-2`; current page/section `.active` = `--accent-ink`
  on `--accent` fill. Then theme toggle (40×40 icon button, `--ink-soft`,
  hover `--accent`), then clock pill. `.nav-toggle` hidden.
- **Mobile nav (≤720px) — the real one.** `.site-nav` becomes a full-width
  disclosure panel under the header bar: `position: absolute; top: 100%;
  left/right: 0;` `--paper` bg, `--elev-2`, 1px `--rule` bottom border,
  links stacked as 48px-tall rows (padding 12px 20px, 1px `--rule-soft`
  dividers), hidden until `html.nav-open`. `.nav-toggle` is visible (44×44,
  three 2px `--ink` bars → ✕ when open via `aria-expanded` styling hook).
  chrome.js toggles `aria-expanded` + the `nav-open` class; Esc closes and
  returns focus to the toggle; clicking a link closes. All five destinations
  reachable — Foundations / Genres / Other Topics / Rudiments / Metronome.
  Header row at ≤720px: `logo … theme-toggle clock-pill nav-toggle`
  (pill shrinks: dot + BPM, `.clock-pill__sig` hidden ≤480px). At 390px the
  row fits in one line at all states — verified in the harness.
- **Sticky behavior**: header stays `position: sticky; top: 0; z-index: 10;`
  bg `--bg`, 1px `--rule` bottom border. `--header-h` token feeds
  `.curriculum-sidebar { top: var(--header-h) }` (replaces the hardcoded
  `60px`) and a new global `:target`/section rule
  `[id] { scroll-margin-top: calc(var(--header-h) + 12px) }` so `/#tracks`
  anchors stop hiding under the sticky header.
- **Theme toggle states**: `aria-label` flips ("Switch to dark theme" ↔
  "… light theme"); icon = sun in light, moon in dark (two inline SVG paths,
  CSS-swapped on `[data-theme]`/media). Persisted as `dc_theme` in
  localStorage; unset = follow system (§1.3). Focus ring per global.
- **Clock pill** (collapsed clock-tower state — full behavior in §8): mono
  0.78125rem (12.5px), `--paper` bg, 1.5px `--rule` border, `--r-pill`,
  padding 6px 12px 6px 8px; the dot is a 20px `--accent` disc with
  `--accent-ink` glyph. Running: dot glyph ■ and a color pulse on each beat
  (color-only under reduced motion). Hover: border `--accent`.
- **Skip link**: unchanged markup/behavior; retinted (`--accent` bg,
  `--accent-ink` text); stays the first tab stop, `z-index` above header.

Both themes: header/bg/border/nav colors all flow from tokens — no
theme-specific header rules beyond the token re-declaration.

---

## 4. Footer — the notice board

Replaces the current one-line `.site-footer` (base.njk):

```html
<footer class="site-footer">
  <div class="site-footer__grid">
    <div class="site-footer__id">
      <svg class="site-footer__seal" …aria-hidden="true"><!-- seal, 40px --></svg>
      <p class="site-footer__motto">The door's open. Bring sticks.</p>
      <p class="site-footer__fine">A free town for learning the drums. No accounts, no sign-ups — your progress lives in your own browser.</p>
    </div>
    <nav class="site-footer__col" aria-label="Lessons"><h2>Lessons</h2>
      <ul><li><a href="/#foundations">Foundations</a></li><li><a href="/#tracks">Genre tracks</a></li><li><a href="/#mastery">Other topics</a></li></ul></nav>
    <nav class="site-footer__col" aria-label="Reference"><h2>Reference</h2>
      <ul><li><a href="/rudiments/">The 40 rudiments</a></li><li><a href="/metronome/">The metronome</a></li></ul></nav>
    <nav class="site-footer__col" aria-label="The town"><h2>The town</h2>
      <ul><li><a href="…GitHub…">GitHub</a></li><li><a href="/lessons/the-drum-kit/">Start at lesson one</a></li></ul></nav>
  </div>
  <p class="site-footer__base">drum.town · 217 lessons · 852 playable exercises · 40 rudiments · notation rendered with VexFlow at build time · built on Eleventy</p>
</footer>
```

- Surface `--paper-2`, 1px `--rule` top border. Grid `1.2fr 1fr 1fr 1fr`,
  gap 32; ≤820px `1fr 1fr`; **≤560px single column** (id block first).
  Column headings: meta label style in `--accent`; footer h2s are fine for
  outline (footer follows main content; heading-order audit tolerates
  h2-in-footer — verify `dom.headingOrderViolations` stays 0, else drop to
  styled `<p>`).
- Motto: Fraunces 600 italic 1.125rem `--ink`. Fine print: small step,
  `--ink-soft`. Base line: meta-sm (11px floor) mono `--ink-soft`, top
  hairline, counts rendered from the same filters the homepage uses.
- 390px: single column, groups stacked, base line wraps. Links ≥44px targets
  (8px vertical padding + list margins).

---

## 5. Homepage hero + ledger

### 5.1 Hero (thesis + CTA pair)

The `#hero-default` / `#hero-upnext` **swap dies**. One hero, always the
thesis; the returning-visitor state is carried by the CTA row, not by
replacing the headline (index.njk):

```html
<section class="hero">
  <p class="eyebrow">drum.town · a free town for learning the drums</p>
  <h1>The whole town practices to the same <em>clock.</em></h1>
  <p class="hero__dek">A complete curriculum you can walk: <strong>{{ curriculum | lessonCount }} lessons</strong> with real notation you can press play on, <strong>{{ lessonContent | exerciseCount }} exercises</strong>, <strong>40 rudiments</strong> — free, in your browser, no sign-up.</p>
  <div class="hero__actions">
    <a class="btn btn--primary" href="/lessons/{{ curriculum.foundations.sections[0].lessons[0].slug }}/">Start here — your first lesson <span aria-hidden="true">→</span></a>
    <a class="btn btn--ghost" id="cta-continue" href="#" hidden>Continue — <span data-slot="title"></span> <span aria-hidden="true">→</span></a>
  </div>
  <p class="hero__honesty"><strong>The town remembers.</strong> Your progress lives in this browser — no account, nothing to join.</p>
  <p class="hero__honesty" id="hero-completed-msg" hidden>You've finished every ready lesson. <a href="…issues…">What should the town build next? →</a></p>
</section>
```

- Left-aligned, `max-width: 720px` inside `.container--wide`; display-1 with
  `em` italic `--accent` on "clock."; dek = lede step `--ink-3`, counts in
  `strong --ink`. Requires one new 5-line `.eleventy.js` filter
  (`exerciseCount`, summing `lessonContent[*].exercises.length` = 852).
- **Conditional continue state**: the existing activation script keeps its
  data source (`#lessons-data` JSON + `DCProgress.getLastVisited()`); instead
  of swapping heroes it (a) fills `#cta-continue` with the *next* lesson after
  `lastVisited` (`href` + title slot) and unhides it; (b) end-of-list ⇒ show
  `#hero-completed-msg` instead. First-time visitors see exactly one CTA.
  Both buttons wrap side-by-side ≥480px, stack full-width at 390px (primary
  first, both 100% width, centered text).
- Solves **BL-045** (primary action) with honest copy; no fake activity.

### 5.2 Ledger chapter list (C's graft — replaces the chip grid)

One `.ledger` section per chapter (11 foundations sections, 7 tracks,
1 mastery = 19; anchors `#foundations`, `#tracks`, `#mastery` stay on the
first of each group). Markup (index.njk):

```html
<section class="ledger" id="foundations">
  <header class="ledger__head">
    <span class="ledger__kicker">Chapter {{ n }} of 19</span>
    <h2 class="ledger__title">{{ sec.title }}</h2>
    <span class="ledger__count">{{ sec.lessons.length }} lessons</span>
  </header>
  {% if sec.tagline %}<p class="ledger__tagline">{{ sec.tagline }}</p>{% endif %}
  <ol class="ledger__rows">
    <li><a class="ledger-row" href="/lessons/{{ lesson.slug }}/">
      <span class="ledger-row__num">{{ loop.index | pad2 }}</span>
      <span class="ledger-row__title">{{ lesson.title }}</span>
      <span class="ledger-row__leader" aria-hidden="true"></span>
      <span class="ledger-row__meta"><span class="ledger-row__min">{{ lessonContent[lesson.slug].duration }}</span><span class="ledger-row__mark" aria-hidden="true"></span></span>
    </a></li>
    …
  </ol>
</section>
```

Every lesson has a duration (`"12 min"` / `"15–20 min"` — verified across all
217 entries), so the minutes column is fully data-backed; render it verbatim.

- **Row anatomy (≥561px)**: flex, baseline-aligned. num = mono meta-sm
  `--ink-soft`, 2.5ch; title = Fraunces 600 1.125rem `--ink`; leader =
  `flex: 1`, `border-bottom: 1.5px dotted var(--rule)`, `translateY(-4px)`,
  `min-width: 40px` (a flex spacer — nothing typed, nothing to orphan);
  min = mono meta-sm `--ink-soft`, `white-space: nowrap`; mark = mono
  meta-sm, fixed 64px right-aligned. Row padding 13px 6px (≥48px tall);
  hover `background: var(--paper)`; rows divided by 1px `--rule-soft`
  hairlines; chapter head gets a 2px `--ink` bottom rule (C's ledger head).
- **States** (existing hooks — the homepage script re-targets its
  `querySelectorAll('.chapter-lesson')` to `.ledger-row`):
  - `.is-visited`: mark shows `✓ done` in `--green` (CSS `::before` content
    on the mark span), num turns `--green`; row also appends a
    `<span class="sr-only">visited</span>` (added by the same JS that adds
    the class, so the state is announced, not just painted).
  - `.is-last-visited` ("you are here"): mark shows `● here` in `--accent`
    600; `box-shadow: inset 3px 0 0 var(--accent)`; title `--accent`;
    sr-only "current lesson".
  - Focus: global ring around the whole row (`outline-offset: -2px` so it
    stays inside the list gutter).
- **Legend** (homepage only — the one place legend vocabulary lives): under
  the last foundations ledger *or* once under the hero; mono meta-sm
  `--ink-soft`: `✓ streets you've walked · ● you are here · ○ still to visit`.
- **390px stacking (mandatory design, C skipped it)**: at ≤560px each row
  becomes a two-line grid — this is the canonical answer, not an accident of
  wrapping:

  ```css
  @media (max-width: 560px) {
    .ledger-row { display: grid; grid-template-columns: 2.5ch 1fr; row-gap: 2px; padding: 10px 4px; }
    .ledger-row__leader { display: none; }
    .ledger-row__title { grid-column: 2; }            /* wraps freely */
    .ledger-row__meta  { grid-column: 2; display: flex; gap: 10px; }  /* "12 min  ✓ done" */
  }
  ```

  Line 1: `01  The Kit: What's What` (title wraps under itself, never under
  the number). Line 2, indented to the title column: `12 min   ✓ done`.
  Total row height ≥48px ⇒ comfortable tap target; no dotted leader at this
  width (leaders are a wide-format instrument); nothing can orphan because
  there are no inter-item separators at all. Solves **BL-044** at every width.
- Chapter head at ≤560px: kicker above, title full width, count drops next to
  kicker (`flex-wrap`).
- Dark theme: same structure; hover row = `--paper`; done = dark `--green`;
  here-bar = terra. All via tokens.

---

## 6. Lesson page

### 6.1 Title block (dedupe the label pile-up)

Today's stack — breadcrumb + `.eyebrow` + h1 + `.lesson-meta` — repeats the
section name up to four times in one quadrant. New block (lessons.njk):

```html
<header class="lesson-hero">
  <p class="breadcrumb">
    <a href="/">Lessons</a> <span class="breadcrumb__sep" aria-hidden="true">/</span>
    {# track: #}<a href="/genres/{{ lesson.track }}/">{{ lesson.trackTitle }}</a> <span…>/</span> {{ lesson.levelTitle }}
    {# foundations: #}Foundations <span…>/</span> {{ lesson.subSectionTitle }}
    {# mastery: #}Other Topics
  </p>
  <h1>{{ lesson.title }}</h1>
  <p class="lede">{{ content.tagline }}</p>
  <div class="lesson-chips">
    <span class="chip"><i aria-hidden="true">⏱</i>{{ content.duration }}</span>
    {% if content.focus %}<span class="chip"><i aria-hidden="true">◎</i>{{ content.focus }}</span>{% endif %}
  </div>
</header>
```

- The `.eyebrow` line is **deleted** on lesson pages (its data now lives once,
  in the breadcrumb). `.lesson-meta`'s "Duration ·/Focus ·" prefixes are
  replaced by glyph chips (no label text repeated). Result: each section name
  appears at most twice on screen (breadcrumb + sidebar), meeting the BL-045
  label-redundancy acceptance.
- Breadcrumb: meta step (12px mono, 0.14em caps), links `--accent`, current
  segment plain `--ink-soft`; h1 = display-2; lede = 1.125rem `--ink-3`;
  bottom 1px `--rule` border, 28px padding-bottom (kept from today).
- **Prereqs** `.prereqs` (restyle, same markup): label text stays
  "Prerequisites" (meta step, `--accent`); links become chip-like pills
  (`--paper-2` bg → hover `--accent` fill/`--accent-ink`); box loses its
  border and sits as a plain row (label + wrapped pills) directly under the
  title block.
- 390px: breadcrumb wraps (no ellipsis); h1 clamps to 2rem; chips wrap to two
  rows; the block (not the sidebar) owns the first screen — see §6.3.

### 6.2 Prose set (the most common objects on the site)

All inside `.lesson-prose` (markup unchanged; bodyHtml is authored content):

- **Paragraphs**: body step on `--ink-2`, measure 65ch, lh 1.7. Two
  consecutive paragraphs are separated by 1em — no first-line indents.
- **Lists** (`ul.bulleted`, plus bare `ul/ol` in bodyHtml): 0.96875rem,
  `padding-left: 20px`, 8px item gap, markers `--accent`
  (`::marker { color: var(--accent) }`).
- **Tip / callout** (`.tips`, `.callout` — same component): `--paper` card,
  `--r-s`, 1px `--rule-soft` border + `3px solid var(--green)` left edge,
  padding 14px 18px, small step on `--ink-2`, `strong` in `--green` 600.
  Green = advice (accent stays reserved for actions/links so tips don't read
  as clickable). Dark: same slots; the green left edge reads as lamp-lit moss.
- **Graduation criteria** (`.grad-criteria`): `--paper` card, `--r-m`, 1px
  `--rule` border; label "Move on when" in meta step `--green`; items keep
  the ✓ `::before`, retinted `--green`; body small step `--ink-2`.
- **Listening block** (`.listening`, markup unchanged): head row = meta step,
  eyebrow `--accent`, count `--ink-soft`; title = Fraunces 600 italic
  1.75rem; intro = body italic `--ink-soft` (Public Sans italic); items keep
  the `32px 1fr` grid, hairline-separated; artist = Public Sans 700 `--ink`
  (was display serif — sturdier), work = Fraunces 600 italic 1.0625rem
  `--accent`… **no** — one accent job per row: artist `--ink` 700, work
  italic `--ink-2`, context tag = meta-sm `--ink-soft`, note = small
  `--ink-3`. Numbers = mono meta-sm (11px, up from 10px).
- **Where next** (`.section-label` + `.lesson-row`): rows become `--paper`
  cards, `--r-m`, 1px `--rule`, title Fraunces 600 1.1875rem, hover border
  `--accent` + `translateX(2px)` (existing behavior, kept; suppressed by
  reduced-motion block).

### 6.3 Curriculum sidebar → lesson map disclosure (BL-037)

Desktop (>960px) — restyle only: 300px sticky column, `top:
var(--header-h)`, `--paper` bg, right `--rule` border; `.island-back`,
`.island-eyebrow` raised to meta-sm/meta; `.curr-item a` = Public Sans
0.875rem `--ink-3`, 6px 10px padding, `--r-s`, current = `--paper-2` bg +
2px `--accent` left inset + 600. Auto-centering scroll script unchanged.

≤960px — the sidebar collapses to a **closed-by-default disclosure bar**
(curriculum-sidebar.njk + section-nav.njk get a toggle button; chrome.js
drives it):

```html
<aside class="curriculum-sidebar" aria-label="Curriculum navigation">
  <button class="curriculum-sidebar__toggle" type="button" aria-expanded="false" aria-controls="lesson-map-panel">
    <span class="curriculum-sidebar__k">In this chapter</span> {{ chapterName }} <span class="curriculum-sidebar__car" aria-hidden="true">▾</span>
  </button>
  <div class="curriculum-sidebar__inner" id="lesson-map-panel"> …existing content… </div>
</aside>
```

- >960px: toggle hidden (`display:none`), inner always shown — zero JS on
  desktop. ≤960px: inner hidden unless `.is-open`; the bar is one 48px row
  (`--paper`, bottom `--rule` border, meta kicker + chapter name); open panel
  `max-height: 60vh; overflow-y: auto`. State is not persisted (closed each
  load — the lesson owns the first screen every time). Acceptance for BL-037:
  at 390px the lesson h1 is visible in the first viewport.

### 6.4 Exercise card (shortcode in .eleventy.js — markup mostly kept)

`.exercise` (existing structure: header → optional desc → notation → tip →
optional lesson link):

- Card: `--paper`, 1px `--rule`, `--r-l`, `--elev-1`, padding 20px 22px
  (16px 12px at ≤400px — keep today's steps). `content-visibility: auto` +
  `contain-intrinsic-size` **kept verbatim** (rudiments page perf depends on
  it).
- Header: `.exercise-title` = h3 step (Public Sans 700 1.25rem → 1.125rem
  ≤720px); `.exercise-meta` = mono meta-sm `--ink-soft` (was `--accent`;
  accent was doing decoration duty — meta is information). Controls right:
  kit select = mono meta-sm in a `--r-pill` 1.5px `--rule` field (keep the
  dual-gradient chevron, retinted); **play button** = `--accent` fill,
  `--accent-ink` text+icon, `--r-pill`, mono 0.6875rem caps kept, states:
  hover/active `--accent-2`, `.is-loading` keeps the icon pulse (existing
  keyframes), `.is-playing` = `--accent-2` fill (player.js already swaps
  ▶/■/⏳ text + aria-labels — no JS change). The gold-icon-on-ink treatment
  dies with the ink button; `--gold` returns to decorative duty.
- `.exercise-tip`: folds into the §6.2 tip treatment (shared rules).
- 390px: `.exercise-header` wraps (existing `flex-wrap`); controls become a
  full-width row under the title (`.exercise-controls { width: 100%;
  justify-content: flex-end }` ≤560px), select grows `flex: 1`. Play target
  ≥44px tall.

### 6.5 Notation frame + the mobile legibility strategy (not deletion)

The frame (`.notation`): `--notation-bg` ground, `--notation-ink` via
`currentColor` (already routed at build time), 1px `--rule-soft` border,
`--r-s`, padding 8px, `overflow-x: auto`, `-webkit-overflow-scrolling:
touch`, `scrollbar-width: thin`. Playhead: `stroke: var(--notation-accent)`
(theme-invariant — see §1.3).

**Legibility strategy at 390px — larger engraving + a higher scroll floor +
a visible pan affordance** (measured against the real renderer output; a
dense one-bar sixteenth pattern renders at viewBox width 760):

1. **Larger engraving for the parts that carry the lesson**
   (tools/notation-renderer.js): sticking annotations go from Arial 10 → **14**
   (grace-note sticking 8 → **10**). When any note in the spec carries
   sticking and no explicit `height` is set, the default SVG height grows
   130 → **140** so the taller annotations never clip. (Build-time change;
   all 852 staves re-render; accents `>` and noteheads scale with the stave
   itself and gain legibility from step 2.)
2. **Raise the scroll floor** (.eleventy.js exercise shortcode): the
   min-width floor for wide staves goes from 55% → **70%** of natural width
   (`minW = natW > 620 ? round(natW * 0.70) : 0`). Arithmetic at true 390px
   (inner scroller ≈ 320px): a 760-unit stave pans at scale 0.70 instead of
   rendering at 0.55 ⇒ sticking letters render at 14 × 0.70 ≈ **9.8px**
   (up from 10 × 0.55 = 5.5px today), accent carets ≈ 1.8× today's size.
   Multi-bar staves (cap 1400 units) pan across ~3 screens with legible
   notes — honest panning beats illegible shrinking. Desktop is also
   upgraded: at scale ≈ 1.0 sticking is now 14px.
3. **Pan affordance** (shortcode + CSS): when the shortcode applies a floor
   it adds `notation--pan` to the frame. CSS gives panning frames a
   right-edge fade (`mask-image`/gradient overlay in `--notation-bg`) and a
   thin always-visible horizontal scrollbar (styled webkit + `scrollbar-width:
   thin`), so "there is more bar to the right" is visible, not discovered.
   `aria-label` on the SVG (already emitted per exercise) continues to carry
   the full pattern description for non-visual users.

Nothing is hidden, removed, or truncated at any width. Gate: at 390px the
paradiddle lesson's sticking row must be readable in a harness screenshot
(letters ≥ ~9.5px rendered), and no annotation clips at 1280px.

---

## 7. Transport dock metronome — "the clock tower" (B's graft)

Two states, one instrument. **Collapsed = the header clock pill (§3), zero
content footprint at every width. Expanded = a full-width bottom dock; the
body reserves its height; overlap is impossible by construction** (BL-036,
structurally, at all widths).

### Markup (base.njk — same element, same control IDs so metronome.js keeps
its wiring; classes re-housed)

```html
<aside class="transport is-collapsed" id="site-metronome" aria-label="Metronome">
  <div class="transport__row">
    <button class="transport__go" id="metronome-toggle" type="button" aria-label="Start metronome"><span class="transport__icon" aria-hidden="true">▶</span></button>
    <label class="transport__bpm-wrap"><input type="number" class="transport__bpm" id="metronome-bpm" …existing attrs… /><span class="transport__bpm-label" aria-hidden="true">BPM</span></label>
    <input type="range" class="transport__slider" id="metronome-slider" …existing attrs… />
    <select class="transport__timesig" id="metronome-timesig" …existing options…></select>
    <div class="transport__beats" id="metronome-beats" aria-hidden="true"></div>
    <span class="transport__vol"><span class="transport__vol-icon" aria-hidden="true">♪</span><input type="range" class="transport__volume" id="metronome-volume" …existing attrs… /></span>
    <button class="transport__collapse" id="metronome-collapse" type="button" aria-expanded="true" aria-label="Collapse metronome">▾</button>
  </div>
</aside>
```

### Behavior (metronome.js — extension, not rebuild)

- `applyCollapsed()` keeps its localStorage key (`dc_metro_collapsed`) and
  gains three duties: toggle `.is-collapsed` on the aside, toggle
  `html.transport-open`, and mirror `aria-expanded` onto the **pill**
  (`#metronome-pill`). Default when no stored value: **collapsed on all
  widths** (the pill is always present; the dock is one tap away) — replaces
  the current small-screen-only default.
- Pill click ⇒ expand + move focus to `#metronome-toggle`. Collapse button ⇒
  collapse + return focus to the pill. Esc inside the dock ⇒ collapse (same
  focus return). The metronome **keeps ticking when collapsed**; the pill's
  dot pulses with the beat (downbeat = `--accent`, others = `--gold`;
  color-only under reduced motion) and shows ■ while running, so running
  state is never hidden (addresses the BL-043 "hidden stop" complaint —
  state visible, stop is one tap away).
- `setBpm()` additionally writes the BPM into `.clock-pill__bpm`;
  the timesig change handler updates `.clock-pill__sig`.

### Layout

```css
html.transport-open body { padding-bottom: calc(var(--transport-h) + 12px); }
.transport { position: fixed; inset: auto 0 0 0; z-index: 50;
  background: var(--paper); border-top: 1px solid var(--rule);
  box-shadow: 0 -6px 22px var(--shadow); }
.transport.is-collapsed { display: none; }
```

- **Desktop/tablet open state**: one 64px row (`--transport-h: 64px`),
  content max-width 1200px centered: go button (44px `--accent` disc,
  `--accent-ink` icon; `.is-playing` = `--accent-2` + ■), BPM number input
  (mono 1.125rem, 72px, `--r-s` field on `--bg`), tempo slider (`flex: 1`,
  4px `--rule` track, 16px `--accent` thumb — thumb up from 13px for touch),
  time-signature select (mono field), beat dots (10px discs, `--rule` idle;
  active beat `--gold`; **downbeat active `--accent` — B's red dot,
  mandatory**; +`transform: scale(1.35)` pulse that reduced-motion strips,
  color still carries the beat), volume (♪ + 96px slider), collapse chevron.
- **≤720px open state**: two rows (`--transport-h: 100px` via media
  re-declaration): row 1 = go · BPM · beat dots · collapse; row 2 = slider
  (flex 1) · timesig · volume. Grid template areas; 12px 16px padding; every
  control ≥44px target. At 390px nothing wraps further (verified in
  harness).
- The reserve is on `<body>` padding, so the last stave, the graduation
  criteria, and the footer all scroll fully clear of the dock at every width
  — content and dock can never share pixels. The old floating-card CSS
  (`position: fixed; bottom/right; width: 168px`) and its `@media (max-width:
  720px)` patch are deleted.
- Dark theme: dock `--paper` on umber, dots as above (terra downbeat,
  lamplight-amber others) — tokens only.

/metronome/ page copy references the corner widget ("docked in the corner of
your screen right now") — amended to point at the header pill/dock (two
sentences; flagged UI-truth fix, not a content rewrite).

---

## 8. Page specs

### 8.1 `/` (homepage)

Changes: hero per §5.1 (thesis headline, CTA pair, honesty line); ledger per
§5.2 replacing `.chapter`/`.chapter__lessons`/`.chapter-lesson`; legend
appears once; activation script re-targeted (`.ledger-row`, continue CTA,
completed message). Stays: `.container--wide`, section anchor IDs, the
`#lessons-data` JSON island, chapter grouping/order, all URLs.

### 8.2 `/lessons/<slug>/`

Changes: title block per §6.1 (breadcrumb consolidation, eyebrow deleted,
chips), prereqs restyle, prose set per §6.2, exercise cards per §6.4,
notation per §6.5, sidebar disclosure per §6.3, grad criteria + listening +
where-next restyles. Stays: lesson-layout grid (incl. the `min-width: 0`
guards and their comments — they are load-bearing), JSON-LD, sidebar
auto-scroll script, `setLastVisited` tracking, stub-message fallback
(restyled: `--paper` card + btn--ghost back link).

### 8.3 `/genres/<slug>/`

Changes: the inline-styled breadcrumb is replaced with the real `.breadcrumb`
component (kills the BL-032 instance); `genre-hero` h1 splits — title stays
h1 (display-2), tagline moves out of the h1 into the lede line; level blocks
keep `.level-block` headers (Fraunces h2 + level tag) and their `.lesson-row`
lists become **ledger rows** (num · title · leader · minutes from
`lessonContent[slug].duration`) so the whole site speaks one list language.
Section-nav sidebar behaves per §6.3 at ≤960px. Stays: pagination, URLs,
level grouping.

### 8.4 `/rudiments/`

Changes: hero per lesson title block (breadcrumb "Lessons / Rudiments" style
line optional — page is top-level, so: eyebrow-style meta line "Reference",
kept, at meta size); a **family index chip row** under the lede — four anchor
chips (Roll Rudiments · Paradiddles · Flams · Drags) jumping to the existing
`id="{{ group.slug }}"` section labels (scroll-margin honors `--header-h`);
group headings restyled (h2 display step + meta kicker); the 40 cards inherit
§6.4/§6.5 automatically. Stays: exercise shortcode markup,
content-visibility perf strategy, group order/ids.

### 8.5 `/metronome/`

Changes: title block restyle (inherited); two copy sentences updated to match
the new home of the clock (§7); a `btn--primary` "Open the metronome" button
added under the lede that expands the dock (`onclick` → the same expand path;
progressive: it's an enhancement over the always-present pill). Prose/lists
inherit §6.2. Stays: all teaching content, bulleted lists, internal links.

### 8.6 `404`

Changes: restyled by inheritance (title block, tokens); copy gains the town
voice in chrome only: eyebrow "404", h1 "Page not found", lede unchanged,
actions become a CTA pair — `btn--primary` "Back to the lessons" (/) +
`btn--ghost` "The 40 rudiments" (/rudiments/). Stays: permalink,
excludeFromCollections.

---

## 9. Migration map (style.css sections / classes)

| existing | fate |
|---|---|
| `:root` token block | **extend in place** — same slots, new values, new slots appended (§1) |
| `@import` fonts line | **replace** with head `<link>`s (§1.4) |
| base `html,body`, `a`, `:focus-visible`, reduced-motion block, `.container(--wide)` | **keep** (retint via tokens; reduced-motion block extended per §2) |
| `.site-header*`, `.site-logo`, `.site-nav` | **restyle + extend** (seal, 5th link, nav-toggle, theme-toggle, clock-pill, `--header-h`) |
| `.skip-link` | **keep** (retint) |
| `.tag`, `.eyebrow`, `h1–h4`, `p`, `.lede`, `ul.bulleted`, `hr.section-rule` | **restyle** (new scale; sizes raised to the 11px floor) |
| `.curriculum-hero`, `.hero-default__completed`, `.hero-upnext*` | **replace** with `.hero*` (§5.1); hero-upnext CSS deleted |
| `.chapter`, `.chapter__*`, `.chapter-lesson*` (incl. `.is-visited/.is-last-visited` rules) | **replace** with `.ledger*` (§5.2); the two state-class *names* survive on ledger rows |
| `.btn`, `.btn--primary`, `.btn--ghost` | **restyle** (§2) |
| `.genre-hero`, `.level-block*` | **restyle** (§8.3) |
| `.lesson-row` | **restyle**; genre lists migrate to ledger rows, where-next keeps card form |
| `.lesson-layout` (+ min-width guards & comments) | **keep** |
| `.curriculum-sidebar`, `.island-*`, `.curr-*` | **restyle + extend** (disclosure toggle ≤960px, `top: var(--header-h)`) |
| `.lesson-hero`, `.breadcrumb`, `.lesson-meta`, `.section-label` | **restyle**; `.lesson-meta` display replaced by `.lesson-chips`/`.chip`; lesson-page `.eyebrow` usage removed in template |
| `.lesson-prose` | **keep** measure rules; new type values |
| `.exercise*`, `.kit-selector__select`, `.play-btn*`, `@keyframes play-pulse` | **restyle** (content-visibility kept verbatim) |
| `.notation`, `.notation svg`, `.playhead`, `.notation-error` | **restyle + extend** (`--notation-accent`, `.notation--pan`) |
| `.exercise-desc`, `.exercise-lesson-link`, `.tips/.callout`, `.prereqs*`, `.grad-criteria*`, `.listening*` | **restyle** (§6.2) |
| `.stub-message` | **restyle** (light) |
| `.site-footer` | **replace** with notice-board footer (§4) |
| `.metronome*` (entire section incl. collapsed styles + 720px patch) | **replace** with `.transport*` + `.clock-pill` (§7); control IDs preserved |
| responsive blocks (960/720/400) | **rework**: keep breakpoints, update selectors; delete the orphaned `.tracks-grid` rule (defined nowhere) |

**A11y floor — explicitly preserved and re-verified after every package**:
skip link first-in-DOM; `<main id="main">` landmark; h1>h2>h3 order on every
page (`dom.headingOrderViolations` = 0); labeled SVGs (`dom.svgsMissingAria`
budget unchanged; new decorative SVGs are `aria-hidden` + `focusable=false`);
`:focus-visible` everywhere (`css.missingFocusVisible` = 0, `css.outlineNone`
= 0); reduced-motion honored incl. new components; all type in rem
(`css.pxFontSizes` = 0); interactive targets ≥44px; new disclosure widgets
(nav, lesson map, transport) carry `aria-expanded`/`aria-controls` and
keyboard paths (Enter/Space native buttons, Esc closes, focus returned).

## 10. Vocabulary leash (chrome copy canon)

- Nav/footer labels: literal (Foundations, Genres, Other Topics, Rudiments,
  Metronome, Lessons, Reference).
- Homepage-only: legend line vocabulary; "The town remembers." honesty lead.
- Footer-only: motto "The door's open. Bring sticks."
- Never: fake presence ("3 drummers practicing now"), account-ish verbs
  ("join", "sign up"), or map-speak in wayfinding ("The Map", "streets" as
  nav labels).
