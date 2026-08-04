# Improvement loop — progress

Newest first. One line per iteration. Full protocol: `.claude/commands/improve.md` · backlog: `tools/backlog.json`.

## Iteration log

- 2026-08-04 · iter 8 · BL-013 [ui] docked metronome is now collapsible — starts collapsed on phones (was covering ~45% of the viewport), choice persisted
- 2026-08-04 · iter 7 · BL-003 [quality] dead-code sweep — never-rendering preview card removed end-to-end, deprecated lesson.njk deleted, "ready" badge noise gone, hygiene.deadFeatureRefs 4→1 (generalistPath kept as noted data)
- 2026-08-04 · iter 6 · BL-019 [content] American spelling normalized — 119 British forms replaced across all 217 lessons, content.britishSpellings 119→0
- 2026-08-04 · iter 5 · BL-012 [ui] keyboard focus restored — global :focus-visible ring, all 4 outline:none suppressions removed (sliders had no indicator at all)
- 2026-08-04 · iter 4 · BL-002 [quality] multi-bar playback fixed via shared PatternMath — 153 exercises no longer overlap themselves; dotted-note timing (83 notes) fixed as a bonus; playhead syncs
- 2026-08-04 · iter 3 · BL-018 [content] paradiddle factual fix — "eight 16ths per bar" corrected to sixteen (four groups), matching the notation
- 2026-08-04 · iter 2 · BL-010+BL-011 [ui] main landmark, skip link, exercise h3s, all 888 SVGs labeled — dom.pagesMissingMain 228→0, dom.svgsMissingAria 888→0
- 2026-08-04 · iter 1 · BL-001 [quality] all 11 drum keys now sound — player.silentHits 2076→0, unmappedDrumKeys 7→0; ride.wav finally wired
- 2026-08-04 · iter 0 · bootstrap — loop scaffolding, audit-site metrics engine + baseline, backlog seeded (31 items), quarantine, .env untracked

## Blocked on Dylan (the only list you need to read)

- **Rotate the PostHog project token.** `.env` is now untracked and the token no longer ships hardcoded in base.njk, but the old value remains in git history. Rotate it in PostHog settings, then update your local `.env`. (SEC, bootstrap)
- **Getting Started photos** (BL-030 / ISSUES.md #1): stick-grip, setup-posture, the-drum-kit lost their figures because the photos never existed. When you have photos, the loop restores the figure blocks + styles.

## Needs eyes (visual changes awaiting a 5-minute human glance)

- **BL-013 metronome collapse** (iter 8): on desktop, a small − appears in the widget corner — clicking collapses it to a round ♩ button; on a phone (or narrow window <720px) it starts collapsed. Expand, play, collapse while playing — audio should keep running.
- **BL-003 homepage hero + genre cards** (iter 7): after visiting any lesson, the homepage "Up Next" hero should render single-column (the empty preview pane is gone); genre pages and Where-Next cards no longer show the word "ready" under every title; hero stat reads "217 lessons".

- **BL-010 exercise titles div→h3** (iter 2): open any lesson — exercise titles should look identical (the class controls type/margin; only line-height tightened 1.65→1.2 on multi-line titles). Tab from the address bar: a rust "Skip to content" chip should appear top-left and jump to content.

## Needs ear (audio changes awaiting a listen)

- **BL-002 multi-bar looping** (iter 4): play `flam` ex 1 or `latin-clave-intro` (2-bar patterns) — the pattern should loop cleanly end-to-end with no doubling/echo, and the playhead should cross the whole stave exactly once per loop. Also `jazz-ballad` (dotted rhythms) should sit correctly against the count.
- **BL-001 new drum voices** (iter 1): play `the-drum-kit` "Tour of the Kit" (all voices in one exercise), a `latin-cha-cha` bell pattern, a `metal-headbang` china groove, and `basic-fills` toms. Judge: ride vs hat distinction, bell character, crash/china wash, tom pitch spread. Acoustic-kit crash/china/bell are approximations from existing samples (real WAVs would help — ISSUES.md #2).

## Parked

_(none)_

## Metrics snapshots

_(pasted by each discovery pass)_
