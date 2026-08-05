# Rebrand direction decision — 2026-08-05

## Winner: Direction A, "The Square" — amended

Warm civic modern, light-first, the town as literal shared infrastructure.
Chosen by panel vote; Dylan holds a standing veto over this decision.

## The vote

| Judge | 1st | 2nd | 3rd | Deciding reason |
|---|---|---|---|---|
| Maya (first-day beginner, phone) | **A** | C | B | "Feels like a real place that wants beginners; zero gatekeeping." B intimidates. |
| Rob (nightly intermediate) | C | **A** | B | C calmest to practice in; B "thrilling for five sessions, then performative." |
| Sam (low-vision, keyboard) | C | **A** | B | B's red-on-dark is anti-accessible despite passing ratios; C/A focus rings actually visible. |
| Adversarial Reviewer | **A** | C | B | A is the only board aimed at the brief's center (warm AND modern AND public), lowest implementation risk, mechanisms verified against real code. C "a refinement wearing a rebrand's name tag." B "the right parts bin, the wrong brand." |
| Orchestrator | **A** (with grafts) | C | B | Synthesis below captures what C's voters actually valued. |

B is unanimously last: three personas and the reviewer independently converged
on "stage where some perform" ≠ "town where everyone practices."

## Mandatory amendments (from the adversarial review — spec phase contract)

1. **Metronome: kill the covering popover.** Keep A's clock-tower header pill
   (collapsed state, zero footprint at every width), but the expanded/running
   state becomes **B's full-width bottom transport dock** with
   `body { padding-bottom: var(--transport-h) }` — overlap impossible by
   construction; adjust-while-reading restored; keep B's red downbeat dot.
   This resolves BL-036 structurally at all widths.
2. **Chapters: C's ledger replaces A's chip grid.** Dotted-leader rows —
   number, serif title, per-lesson minutes, ✓ done / ● here marks on the
   existing `.is-visited` / `.is-last-visited` hooks. Resolves BL-044 and adds
   time-budget info. The spec MUST design its 390px stacking (C skipped it).
3. **Headline carries the thesis.** Not "Welcome to Drum Town." — promote A's
   buried line to display: **"The whole town practices to the same clock."**
   Take C's header-nav Metronome link (full IA parity in the chrome).

## Shared violations every board dodged — spec must solve them

- **Real mobile navigation** (no board designed any; hamburger/disclosure at
  ≤720px reaching Foundations/Genres/Other Topics/Rudiments/Metronome).
- **Honest mobile notation**: a legibility strategy for sticking letters and
  accents at 390px (scroll floor, stacked bars, or larger engraving — not
  deletion, which is what all three boards silently did).
- **Theme toggle**: design the actual control (header placement, both themes).
- **Real prose components**: two consecutive paragraphs, lists, tip/callout,
  Listening block, graduation criteria — the most common objects on the site;
  import C's prose-column reading discipline (measure, leading) into A's
  palette so Rob's and Sam's C-votes are honored.
- **Keep today's token slot names** (`--bg/--paper/--paper-2/--ink/...`);
  extend, don't rename. Dark theme ships as a `[data-theme]`/media
  re-declaration, not parallel token sets.
- **Font payload restraint**: named weights/styles only, no full variable
  axes; measure the woff2 bill before committing.
- Metaphor on a leash: nav says "Lessons," not "The Map"; legend vocabulary
  stays on the homepage; meta/mono text sizes get a floor (≥11px equivalent,
  contrast-checked); one accent hue owns primary actions across both themes.

## What was rejected, for the record

- **B "Count-In"**: night-venue identity fails "warm, public, together";
  dark-first long-form reading, sub-minimum nav targets, false-affordance tab
  strip. Salvaged: the transport dock, the downbeat dot, dark-mode's
  "score is the one lit object" position (kept: staves stay paper-lit in dark).
- **C "The Woodshed"**: truest communal copy, best reading column — but
  under-delivers the rebrand ("they cleaned up," not "it's a town now") and
  its own mobile mock contradicts its "geometry, not luck" metronome claim.
  Salvaged: the ledger, prose discipline, "Practice alone, together" as a
  candidate community-page line.

## Phase

`directions` → **`spec`**: the Designer expands amended-A into
`design/system.md` (tokens, type scale, components incl. the dodged ones,
per-page specs) and appends ordered build packages to `tools/backlog.json`.
