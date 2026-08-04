# Improvement loop — progress

Newest first. One line per iteration. Full protocol: `.claude/commands/improve.md` · backlog: `tools/backlog.json`.

## Iteration log

- 2026-08-04 · iter 24 · BL-035 [ui] resolved as measurement artifact — Windows headless Edge floors at ~492px and crops, so all "mobile clipping" was a cropped healthy layout; true-390 iframe harness committed (tools/mobile-viewport-harness.html), protocol updated; the mobile site renders cleanly (BL-037 sidebar + BL-044 dashes confirmed real)
- 2026-08-04 · iter 23b · adversarial critique integrated — 4 factual listening errors fixed same-tick (50 Ways sticking claim, AOBTD kick claim, Tom Sawyer doubles claim, Green Onions swapped for Billie Jean), 3 style-guide violations in my own prose fixed (incl. the paradiddle banned opener), 9 new items filed (BL-038..046: playhead scroll-fight P1, audio voice honesty, density-aware notation floor, heading-audit sampling gap, and more); 16 of 31 new listening picks verified correct
- 2026-08-04 · iter 23 · loop upgrade [Dylan's feedback] — visual verification (headless-Edge screenshots, read + judged) and an adversarial critic subagent are now protocol steps 6b/6c; first visual pass found 3 real issues no gate saw: mobile horizontal clipping (BL-035, P1), metronome overlapping content at 1280px (BL-036), sidebar-above-lesson on mobile (BL-037)
- 2026-08-04 · iter 22 · BL-017 [ui] prefers-reduced-motion respected — animations collapse, metronome dots stop pulsing (color still marks the beat); css.missingReducedMotion 1→0
- 2026-08-04 · iter 21 · BL-007 [quality] rudiments page render cost fixed via content-visibility — off-screen cards skip layout/paint; scrollbar stays stable
- 2026-08-04 · iter 20 · discovery #2 — link scan clean, no new issues, nothing parked in 19 ticks; all remaining metrics map to ready backlog items
- 2026-08-04 · iter 19 · BL-023 chunk 1/6 [content] 31 listening picks added across 13 lessons (Foundations + track intros) — lessonsMissingListening 77→64
- 2026-08-04 · iter 18 · BL-016 [ui] dark-mode groundwork — notation ink routed through currentColor + tokens; the white/black island is no longer hardcoded
- 2026-08-04 · iter 17 · BL-006 [quality] legacy audit output cleaned — float noise rounded, clave Total added, baseline regenerated
- 2026-08-04 · iter 16 · BL-022 chunk 1/6 [content] 10 thin lessons expanded with practice-method + failure-mode sections — lessonsThinProse 53→43, lessonsNoSubheadings 68→58
- 2026-08-04 · iter 15 · BL-015 [ui] all font sizes in rem — user font-size preferences finally respected; css.pxFontSizes 79→0 (pixel-identical at default settings)
- 2026-08-04 · iter 14 · BL-005 [quality] npm run clean is cross-platform (node fs.rmSync) — verified on PowerShell, idempotent
- 2026-08-04 · iter 13 · BL-021 [content] gear-basics + tuning-basics get real exercises (pad strokes; strike-and-listen tuning drills) — lessonsZeroExercises 2→0; the homepage's "every lesson is playable" promise is finally true
- 2026-08-04 · iter 12 · BL-014 [ui] notation fits phones — single-bar staves size to content (427/888 no longer force horizontal pan), playhead auto-follows scrolling staves
- 2026-08-04 · iter 11 · BL-004 [quality] sitemap is spec-valid — emitted only when SITE_URL is set (absolute URLs), omitted otherwise; dom.relativeSitemapLocs 227→0
- 2026-08-04 · iter 10 · discovery — link scan clean (11,749 refs), no TODO/console.log, +3 polish items (BL-032..034); 12 of 26 gated metrics now at zero
- 2026-08-04 · iter 9 · BL-020 [content] style guide authored (docs/content-style-guide.md) — 24-value focus vocabulary proposed, voice/structure/exercise/listening conventions set; unlocks all rewrite chunks
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

- **Design checkpoint 0 is ready to run.** Type `/design-checkpoint` in a session with me present (~5 min): it builds the component previews and syncs them to a "Drum Town UI" project on claude.ai/design — the first DesignSync call needs your permission grant, which unattended ticks can't do.

- **Rotate the PostHog project token.** `.env` is now untracked and the token no longer ships hardcoded in base.njk, but the old value remains in git history. Rotate it in PostHog settings, then update your local `.env`. (SEC, bootstrap)
- **Getting Started photos** (BL-030 / ISSUES.md #1): stick-grip, setup-posture, the-drum-kit lost their figures because the photos never existed. When you have photos, the loop restores the figure blocks + styles.

## Needs eyes (now mostly self-served: since iter 23 the loop screenshots and reads its own changes — entries below remain only where human taste matters)

- **BL-015 rem type** (iter 15): at default browser settings every size is mathematically identical to before. Worth one check: bump your browser's default font size (Settings → Appearance) — the whole site should now scale with it.
- **BL-014 notation widths** (iter 12): HIGH VALUE GLANCE — single-bar staves now size to their note count, so sparse exercises (e.g. first-beat Build-Up 1, the quarter-note hat bars) render narrower and fit phones. Check 2-3 lessons on desktop (staves shouldn't look oddly short) and one on a phone/narrow window (short exercises shouldn't pan; playing a long stave should auto-scroll the playhead into view).
- **BL-013 metronome collapse** (iter 8): on desktop, a small − appears in the widget corner — clicking collapses it to a round ♩ button; on a phone (or narrow window <720px) it starts collapsed. Expand, play, collapse while playing — audio should keep running.
- **BL-003 homepage hero + genre cards** (iter 7): after visiting any lesson, the homepage "Up Next" hero should render single-column (the empty preview pane is gone); genre pages and Where-Next cards no longer show the word "ready" under every title; hero stat reads "217 lessons".

- **BL-010 exercise titles div→h3** (iter 2): open any lesson — exercise titles should look identical (the class controls type/margin; only line-height tightened 1.65→1.2 on multi-line titles). Tab from the address bar: a rust "Skip to content" chip should appear top-left and jump to content.

## Needs ear (audio changes awaiting a listen)

- **BL-002 multi-bar looping** (iter 4): play `flam` ex 1 or `latin-clave-intro` (2-bar patterns) — the pattern should loop cleanly end-to-end with no doubling/echo, and the playhead should cross the whole stave exactly once per loop. Also `jazz-ballad` (dotted rhythms) should sit correctly against the count.
- **BL-001 new drum voices** (iter 1): play `the-drum-kit` "Tour of the Kit" (all voices in one exercise), a `latin-cha-cha` bell pattern, a `metal-headbang` china groove, and `basic-fills` toms. Judge: ride vs hat distinction, bell character, crash/china wash, tom pitch spread. Acoustic-kit crash/china/bell are approximations from existing samples (real WAVs would help — ISSUES.md #2).

## Parked

_(none)_

## Metrics snapshots

**Discovery iter 20 (2026-08-04), after 18 improvement ticks.** Newly zeroed since iter 10: relativeSitemapLocs 227→0 · lessonsZeroExercises 2→0 · pxFontSizes 79→0. Falling: lessonsThinProse 53→43 · lessonsNoSubheadings 68→58 · lessonsMissingListening 77→64 (+31 picks, now 448 entries). **Still open** (all mapped to ready items): focusDistinctValues 144 (BL-024) · thin/subheads/listening long tails (BL-022/023 chunks) · tempoRangeMetaMismatches 6 (BL-027) · titleNumberingSchemes 5 (BL-026) · duplicatePicks 7 (BL-029) · fewExercises 14 (some intentional — setup/mindset lessons; revisit the floor when BL-022 completes) · dark-scheme + reduced-motion (BL-017 + future theme item) · deadFeatureRefs 1 (noted generalistPath, by design). Link scan clean twice running; zero parked items in 19 ticks.

**Discovery iter 10 (2026-08-04), after 9 improvement ticks.** Zeroed since bootstrap: player.silentHits 2076→0 · player.unmappedDrumKeys 7→0 · player.multiBarSpecsUnsupported 153→0 · dom.pagesMissingMain 228→0 · dom.pagesMissingSkipLink 228→0 · dom.svgsMissingAria 888→0 · css.outlineNone 4→0 · css.missingFocusVisible 1→0 · content.britishSpellings 119→0. Improved: hygiene.deadFeatureRefs 4→1 · css.pxFontSizes 84→79. **Still open**: lessonsMissingListening 77 · lessonsNoSubheadings 68 · lessonsThinProse 53 · focusDistinctValues 144 · pxFontSizes 79 · relativeSitemapLocs 227 · duplicateListeningPicks 7 · lessonsFewExercises 14 · zeroExercises 2 · tempoRangeMetaMismatches 6 · titleNumberingSchemes 5 · dark-scheme/reduced-motion groundwork. Link scan: 11,749 internal refs, all resolve.

_(pasted by each discovery pass)_
