# Improvement loop — progress

Newest first. One line per iteration. Full protocol: `.claude/commands/improve.md` · backlog: `tools/backlog.json`.

## Iteration log

- 2026-08-04 · iter 2 · BL-010+BL-011 [ui] main landmark, skip link, exercise h3s, all 888 SVGs labeled — dom.pagesMissingMain 228→0, dom.svgsMissingAria 888→0
- 2026-08-04 · iter 1 · BL-001 [quality] all 11 drum keys now sound — player.silentHits 2076→0, unmappedDrumKeys 7→0; ride.wav finally wired
- 2026-08-04 · iter 0 · bootstrap — loop scaffolding, audit-site metrics engine + baseline, backlog seeded (31 items), quarantine, .env untracked

## Blocked on Dylan (the only list you need to read)

- **Rotate the PostHog project token.** `.env` is now untracked and the token no longer ships hardcoded in base.njk, but the old value remains in git history. Rotate it in PostHog settings, then update your local `.env`. (SEC, bootstrap)
- **Getting Started photos** (BL-030 / ISSUES.md #1): stick-grip, setup-posture, the-drum-kit lost their figures because the photos never existed. When you have photos, the loop restores the figure blocks + styles.

## Needs eyes (visual changes awaiting a 5-minute human glance)

- **BL-010 exercise titles div→h3** (iter 2): open any lesson — exercise titles should look identical (the class controls type/margin; only line-height tightened 1.65→1.2 on multi-line titles). Tab from the address bar: a rust "Skip to content" chip should appear top-left and jump to content.

## Needs ear (audio changes awaiting a listen)

- **BL-001 new drum voices** (iter 1): play `the-drum-kit` "Tour of the Kit" (all voices in one exercise), a `latin-cha-cha` bell pattern, a `metal-headbang` china groove, and `basic-fills` toms. Judge: ride vs hat distinction, bell character, crash/china wash, tom pitch spread. Acoustic-kit crash/china/bell are approximations from existing samples (real WAVs would help — ISSUES.md #2).

## Parked

_(none)_

## Metrics snapshots

_(pasted by each discovery pass)_
